"""
backend/ml_service.py
Loads trained model artifacts and runs inference.

The primary model is an IsolationForest anomaly detector trained on
well drilling data (ROP, WOB, RPM, Torque, depth_m + optional mud features).

An anomaly_score of 0 = very normal; 1 = highly anomalous.
It is NOT a failure probability and is explicitly labelled as such.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import joblib

from backend.config import settings
from backend import data_service as ds

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Globals
# ─────────────────────────────────────────────────────────
_model = None           # IsolationForest
_preprocessor = None    # StandardScaler
_metadata: Dict[str, Any] = {}
_feature_cols: List[str] = []


# ─────────────────────────────────────────────────────────
# Condition thresholds
# ─────────────────────────────────────────────────────────
_THRESHOLDS = {
    "Normal": 0.35,
    "Elevated": 0.65,
    "Critical": 1.01,   # anything above 0.65
}


def _score_to_condition(score: float) -> str:
    if score <= _THRESHOLDS["Normal"]:
        return "Normal"
    if score <= _THRESHOLDS["Elevated"]:
        return "Elevated"
    return "Critical"


# ─────────────────────────────────────────────────────────
# Model loading
# ─────────────────────────────────────────────────────────

def load_models() -> None:
    global _model, _preprocessor, _metadata, _feature_cols

    models_dir = settings.models_path
    model_path = models_dir / "drilling_anomaly.joblib"
    prep_path = models_dir / "drilling_preprocessor.joblib"
    meta_path = models_dir / "metadata.json"

    if not model_path.exists():
        logger.warning("Drilling anomaly model not found at %s. Run ml/train.py first.", model_path)
        return

    try:
        _model = joblib.load(model_path)
        _preprocessor = joblib.load(prep_path)
        with open(meta_path, "r") as f:
            _metadata = json.load(f)
        _feature_cols = _metadata.get("features", [])
        logger.info("Drilling anomaly model loaded. Features: %s", _feature_cols)
    except Exception as exc:
        logger.error("Failed to load model artifacts: %s", exc)
        _model = None


def is_model_loaded() -> bool:
    return _model is not None and _preprocessor is not None


def get_model_version() -> str:
    return _metadata.get("model_version", "unknown")


# ─────────────────────────────────────────────────────────
# Feature extraction
# ─────────────────────────────────────────────────────────

def _extract_features(well_state: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """
    Build a feature dict from a well_state dict using the trained feature list.
    Missing values are preserved as np.nan so the training-fitted pipeline imputer
    handles them with exact training medians (no arbitrary 0.0 replacement).
    """
    if not _feature_cols:
        return None

    drilling = well_state.get("drilling", {})
    mud = well_state.get("mud", {})
    combined = {**drilling, **mud}

    result: Dict[str, float] = {}
    for col in _feature_cols:
        val = combined.get(col)
        if val is None or pd.isna(val):
            result[col] = np.nan
        else:
            try:
                v = float(val)
                result[col] = np.nan if np.isnan(v) or np.isinf(v) else v
            except (TypeError, ValueError):
                result[col] = np.nan

    return result


def _raw_anomaly_score(X_scaled: np.ndarray) -> float:
    """
    IsolationForest.decision_function returns negative values for anomalies,
    positive values for normal points.
    We remap to 0..1 where 0 = normal, 1 = most anomalous.
    """
    raw = float(_model.decision_function(X_scaled)[0])
    normalised = float(np.clip(0.5 - (raw / 0.25), 0, 1))
    return round(normalised, 4)


# ─────────────────────────────────────────────────────────
# Feature contributions (perturbation-based explainability)
# ─────────────────────────────────────────────────────────

def _compute_contributions(
    features: Dict[str, float],
    base_score: float,
) -> List[Dict[str, Any]]:
    """
    Estimate each feature's contribution by shifting it to baseline (0 in scaled space)
    and measuring the score delta. Returns ranked list of contributions.
    """
    contributions = []
    base_arr = pd.DataFrame([[features.get(f, np.nan) for f in _feature_cols]], columns=_feature_cols)
    base_scaled = _preprocessor.transform(base_arr)

    for i, feat in enumerate(_feature_cols):
        perturbed = base_scaled.copy()
        perturbed[0, i] = 0.0   # shift to standard normal baseline (mean)
        perturbed_score = _raw_anomaly_score(perturbed)
        contribution = round(perturbed_score - base_score, 4)
        val = features.get(feat)
        contributions.append({
            "feature": feat,
            "value": round(val, 4) if val is not None and not np.isnan(val) else None,
            "contribution": contribution,
        })

    # Sort by absolute contribution descending
    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contributions


def _describe_contribution(feat: str, value: Optional[float], contribution: float) -> str:
    """Generate a non-causal, explainable description for a feature contribution."""
    val_str = f"{value:.2f}" if value is not None else "missing/imputed"
    if abs(contribution) < 0.01:
        return f"{feat} ({val_str}) is near the baseline operating range with minimal anomaly impact."
    direction = "elevating" if contribution > 0 else "suppressing"
    return (
        f"Shifting {feat} ({val_str}) toward the reference baseline changes the anomaly score by "
        f"{contribution:+.4f} ({direction} anomaly indicator)."
    )


# ─────────────────────────────────────────────────────────
# Public inference API
# ─────────────────────────────────────────────────────────

def predict_for_well(well_id: str) -> Optional[Dict[str, Any]]:
    """
    Run anomaly detection for the latest state of well_id.
    Returns prediction dict or None if model/data unavailable.
    """
    if not is_model_loaded():
        return None

    well_state = ds.get_well_state(well_id)
    if well_state is None:
        return None

    features = _extract_features(well_state)
    if features is None:
        return None

    X = pd.DataFrame([[features[f] for f in _feature_cols]], columns=_feature_cols)
    X_scaled = _preprocessor.transform(X)
    score = _raw_anomaly_score(X_scaled)
    condition = _score_to_condition(score)

    raw_contributions = _compute_contributions(features, score)
    feature_contributions = []
    for c in raw_contributions:
        feature_contributions.append({
            "feature": c["feature"],
            "value": c["value"] if c["value"] is not None else 0.0,
            "contribution": c["contribution"],
            "description": _describe_contribution(c["feature"], c["value"], c["contribution"]),
        })

    drilling = well_state.get("drilling", {})
    ts = drilling.get("timestamp", "unknown")

    return {
        "well_id": well_id,
        "condition": condition,
        "anomaly_score": score,
        "model_version": get_model_version(),
        "timestamp": ts,
        "features_used": _feature_cols,
        "feature_contributions": feature_contributions,
        "disclaimer": (
            "Anomaly score produced by IsolationForest on historical drilling data. "
            "This is an operational anomaly indicator, NOT a failure probability. "
            "Use as one decision-support input among many."
        ),
    }


def predict_from_features(
    features: Dict[str, Any],
    timestamp: str = "scenario",
    well_id: str = "scenario",
) -> Optional[Dict[str, Any]]:
    """
    Run model on an arbitrary feature dict (used by what-if, replay, and investigate).
    Missing features are imputed via the training-fitted pipeline imputer.
    """
    if not is_model_loaded():
        return None

    row_vals = []
    for f in _feature_cols:
        val = features.get(f)
        if val is None or pd.isna(val):
            row_vals.append(np.nan)
        else:
            try:
                v = float(val)
                row_vals.append(np.nan if np.isnan(v) or np.isinf(v) else v)
            except (TypeError, ValueError):
                row_vals.append(np.nan)

    X = pd.DataFrame([row_vals], columns=_feature_cols)
    X_scaled = _preprocessor.transform(X)
    score = _raw_anomaly_score(X_scaled)
    condition = _score_to_condition(score)

    return {
        "well_id": well_id,
        "condition": condition,
        "anomaly_score": score,
        "timestamp": timestamp,
        "features_used": _feature_cols,
    }


def get_supported_whatif_features() -> List[str]:
    return list(_feature_cols)
