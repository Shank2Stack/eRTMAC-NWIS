"""
backend/evidence.py
Generates evidence package: current feature values, model contributions,
and supporting historical records near the current operating point.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend import data_service as ds
from backend import ml_service as ml

logger = logging.getLogger(__name__)


def get_evidence(well_id: str) -> Optional[Dict[str, Any]]:
    """
    Build an evidence packet for the given well:
    - current feature values
    - feature contributions from ML model
    - supporting historical records (most similar historical rows)
    """
    well_state = ds.get_well_state(well_id)
    if well_state is None:
        return None

    drilling = well_state.get("drilling", {})
    mud = well_state.get("mud", {})
    current_features = {**drilling, **mud}
    # Remove non-numeric housekeeping keys
    current_features.pop("timestamp", None)

    clean_features = {}
    for k, v in current_features.items():
        if v is None or pd.isna(v):
            clean_features[k] = None
        elif isinstance(v, (int, np.integer)):
            clean_features[k] = int(v)
        elif isinstance(v, (float, np.floating)):
            clean_features[k] = None if np.isnan(v) else round(float(v), 4)
        else:
            clean_features[k] = v

    # Feature contributions from ML
    prediction = ml.predict_for_well(well_id)
    feature_contributions = []
    if prediction:
        feature_contributions = prediction.get("feature_contributions", [])

    # Supporting historical records using standardized distance across operating variables
    supporting = _find_supporting_records(well_id, drilling)

    return {
        "well_id": well_id,
        "current_features": clean_features,
        "feature_contributions": feature_contributions,
        "supporting_records": supporting,
        "note": (
            "Supporting records are historical drilling rows from this well "
            "most similar to the current operating state based on standardized feature distance. "
            "Model contributions describe how shifting features toward baseline changes the anomaly score. "
            "No causal claims or fabricated incidents are asserted."
        ),
    }


def _find_supporting_records(
    well_id: str,
    current_drilling: Dict[str, Any],
    n: int = 10,
) -> List[Dict[str, Any]]:
    """Return historical rows from the same well closest to current drilling state using standardized distance."""
    history = ds.get_well_history(well_id, limit=500)
    if not history:
        return []

    df = pd.DataFrame(history)
    numeric_cols = [c for c in df.columns if c not in ("well_id", "timestamp") and pd.api.types.is_numeric_dtype(df[c])]

    curr_vals = {
        k: float(v) for k, v in current_drilling.items()
        if k in numeric_cols and v is not None and not (isinstance(v, float) and np.isnan(v))
    }
    if not curr_vals or not numeric_cols:
        records = df.head(n).to_dict(orient="records")
    else:
        # Standardize each feature by its standard deviation so variables on large scales do not dominate
        stds = {}
        for col in numeric_cols:
            s = df[col].std()
            stds[col] = float(s) if s is not None and s > 1e-6 else 1.0

        def row_standardized_distance(row: pd.Series) -> float:
            total_sq = 0.0
            count = 0
            for col, cv in curr_vals.items():
                rv = row.get(col)
                if rv is not None and not (isinstance(rv, float) and np.isnan(rv)):
                    std_val = stds.get(col, 1.0)
                    total_sq += ((float(rv) - cv) / std_val) ** 2
                    count += 1
            return (total_sq / count) ** 0.5 if count > 0 else float("inf")

        df["_dist"] = df.apply(row_standardized_distance, axis=1)
        records = df.sort_values("_dist").head(n).drop(columns=["_dist"]).to_dict(orient="records")

    cleaned_records = []
    for r in records:
        cleaned = {}
        for k, v in r.items():
            if pd.isna(v):
                cleaned[k] = None
            elif isinstance(v, (int, np.integer)):
                cleaned[k] = int(v)
            elif isinstance(v, (float, np.floating)):
                cleaned[k] = None if np.isnan(v) else round(float(v), 4)
            else:
                cleaned[k] = str(v) if k == "timestamp" else v
        cleaned_records.append(cleaned)

    return cleaned_records
