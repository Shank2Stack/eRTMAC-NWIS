"""
backend/what_if.py
What-if scenario analysis: override supported model features and compare outcomes.

IMPORTANT: This is purely a model estimate for decision support.
It does NOT represent an operational instruction or live system control.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Dict, Optional

import numpy as np

from backend import data_service as ds
from backend import ml_service as ml

logger = logging.getLogger(__name__)


def run_what_if(well_id: str, overrides: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    1. Get current well state → run model → baseline score
    2. Strictly validate overrides (reject NaN, Inf, non-numeric, unsupported)
    3. Apply overrides to canonical feature vector
    4. Run model on modified features through same pipeline → scenario score
    5. Return comparison with explicit hypothetical disclaimer
    """
    if not ml.is_model_loaded():
        return {"error": "Model not loaded. Run ml/train.py first."}

    well_state = ds.get_well_state(well_id)
    if well_state is None:
        return None

    supported = ml.get_supported_whatif_features()

    if not overrides:
        return {"error": "Provide at least one parameter to override."}

    # Strict validation of overrides
    validated_overrides: Dict[str, float] = {}
    for k, v in overrides.items():
        if k not in supported:
            return {
                "error": f"Unsupported what-if feature '{k}'. Supported features: {supported}"
            }
        try:
            val_float = float(v)
        except (TypeError, ValueError):
            return {"error": f"Invalid non-numeric value for override '{k}': {v}"}

        if np.isnan(val_float) or np.isinf(val_float):
            return {"error": f"Invalid numerical value for override '{k}': must be finite"}

        validated_overrides[k] = val_float

    # Build current feature dict from well state (drilling + aligned mud)
    drilling = well_state.get("drilling", {})
    mud = well_state.get("mud", {})
    current_raw = {**drilling, **mud}
    current_features: Dict[str, Any] = {}
    for f in supported:
        val = current_raw.get(f)
        if val is None:
            current_features[f] = np.nan
        else:
            try:
                fv = float(val)
                current_features[f] = np.nan if np.isnan(fv) or np.isinf(fv) else fv
            except (TypeError, ValueError):
                current_features[f] = np.nan

    # Run baseline prediction
    current_result = ml.predict_from_features(current_features, well_id=well_id)
    if current_result is None:
        return None

    current_score = current_result["anomaly_score"]
    current_condition = current_result["condition"]

    # Build scenario features by applying validated overrides
    scenario_features = dict(current_features)
    changed = {}
    for k, v_float in validated_overrides.items():
        orig_val = current_features.get(k)
        orig_clean = (
            round(float(orig_val), 4)
            if orig_val is not None and not np.isnan(orig_val)
            else None
        )
        scenario_features[k] = v_float
        changed[k] = {"from": orig_clean, "to": round(v_float, 4)}

    # Run scenario prediction through same canonical pipeline
    scenario_result = ml.predict_from_features(scenario_features, well_id=well_id)
    if scenario_result is None:
        return None

    scenario_score = scenario_result["anomaly_score"]
    scenario_condition = scenario_result["condition"]

    return {
        "well_id": well_id,
        "current_condition": current_condition,
        "current_anomaly_score": round(current_score, 4),
        "scenario_condition": scenario_condition,
        "scenario_anomaly_score": round(scenario_score, 4),
        "score_change": round(scenario_score - current_score, 4),
        "changed_features": changed,
        "disclaimer": (
            "Hypothetical model estimate only for decision support. "
            "Not an operational drilling command or physical guarantee."
        ),
    }
