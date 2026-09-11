"""
backend/investigate.py
Chronological investigation of a well's drilling history with anomaly scores.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend import data_service as ds
from backend import ml_service as ml

logger = logging.getLogger(__name__)


def get_investigation(well_id: str) -> Optional[Dict[str, Any]]:
    """
    Return the full chronological timeline for a well with anomaly scores.
    Each point uses only information available up to that point (no future leakage).
    """
    history = ds.get_well_history(well_id, limit=500)
    if history is None:
        return None

    feature_cols = ml.get_supported_whatif_features()
    timeline = []
    anomaly_points = []

    depths = []
    for record in history:
        ts = str(record.get("timestamp", ""))
        depth = record.get("depth_m")
        if depth is not None:
            depths.append(float(depth))

        # Mud features strictly at or before ts (no future leakage)
        mud_state = ds._get_mud_at(well_id, ts)

        feat_snapshot: Dict[str, Any] = {}
        for col in feature_cols:
            if col in record and record[col] is not None:
                feat_snapshot[col] = record[col]
            elif col in mud_state and mud_state[col] is not None:
                feat_snapshot[col] = mud_state[col]
            else:
                feat_snapshot[col] = None

        score = None
        condition = None
        if ml.is_model_loaded():
            res = ml.predict_from_features(feat_snapshot, timestamp=ts, well_id=well_id)
            if res:
                score = res.get("anomaly_score")
                condition = res.get("condition")

        point = {
            "timestamp": ts,
            "depth_m": record.get("depth_m"),
            "ROP": record.get("ROP"),
            "WOB": record.get("WOB"),
            "RPM": record.get("RPM"),
            "Torque": record.get("Torque"),
            "anomaly_score": round(score, 4) if score is not None else None,
            "condition": condition,
        }
        timeline.append(point)
        if score is not None and score > 0.65:
            anomaly_points.append(point)

    depth_range = {}
    if depths:
        depth_range = {"min": round(min(depths), 2), "max": round(max(depths), 2)}

    return {
        "well_id": well_id,
        "timeline": timeline,
        "anomaly_points": anomaly_points,
        "depth_range": depth_range,
        "note": (
            "Anomaly scores computed using IsolationForest on historical drilling data. "
            "Each point uses only data available up to that time (no future leakage). "
            "No fabricated events or incidents are included."
        ),
    }
