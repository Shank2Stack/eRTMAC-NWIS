"""
backend/replay.py
Chronological replay of a well's drilling history.

At each replay point, only data available up to that moment is used.
No future leakage.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend import data_service as ds
from backend import ml_service as ml

logger = logging.getLogger(__name__)


def get_replay(well_id: str, max_points: int = 200) -> Optional[Dict[str, Any]]:
    """
    Return all replay points for a well.
    For each historical moment at timestamp T:
    - Queries drilling state at T.
    - Queries mud state at or before T (strictly past-only).
    - Constructs the canonical feature vector.
    - Runs inference through the canonical preprocessing pipeline.
    - Never uses any information after T.
    """
    total_available = ds.get_well_total_records(well_id)
    if total_available == 0:
        return None

    history = ds.get_well_history(well_id, limit=max_points)
    if history is None:
        return None

    feature_cols = ml.get_supported_whatif_features()
    replay_points = []

    for record in history:
        ts = str(record.get("timestamp", ""))
        depth = record.get("depth_m")

        # Mud features strictly at or before ts (no future leakage)
        mud_state = ds._get_mud_at(well_id, ts)

        # Feature snapshot: combines drilling record and past mud state
        feat_snapshot: Dict[str, Any] = {}
        for col in feature_cols:
            if col in record and record[col] is not None:
                feat_snapshot[col] = record[col]
            elif col in mud_state and mud_state[col] is not None:
                feat_snapshot[col] = mud_state[col]
            else:
                feat_snapshot[col] = None

        # Model score via canonical preprocessing pipeline
        score: Optional[float] = None
        condition: Optional[str] = None
        if ml.is_model_loaded():
            result = ml.predict_from_features(feat_snapshot, timestamp=ts, well_id=well_id)
            if result:
                score = result.get("anomaly_score")
                condition = result.get("condition")

        clean_features = {}
        for k, v in feat_snapshot.items():
            if v is None:
                clean_features[k] = None
            else:
                try:
                    fval = float(v)
                    clean_features[k] = None if np.isnan(fval) else round(fval, 4)
                except (TypeError, ValueError):
                    clean_features[k] = None

        replay_points.append({
            "timestamp": ts,
            "depth_m": depth,
            "ROP": record.get("ROP"),
            "WOB": record.get("WOB"),
            "RPM": record.get("RPM"),
            "Torque": record.get("Torque"),
            "anomaly_score": round(score, 4) if score is not None else None,
            "condition": condition,
            "features_at_point": clean_features,
        })

    subsampled = len(history) < total_available
    return {
        "well_id": well_id,
        "total_points": len(replay_points),
        "total_available_points": total_available,
        "subsampled": subsampled,
        "replay_points": replay_points,
    }


def replay_predict(
    well_id: str,
    point_index: int,
) -> Optional[Dict[str, Any]]:
    """
    Run model on a specific replay point by index.
    Only uses features available at that point.
    """
    replay = get_replay(well_id, max_points=500)
    if replay is None:
        return None

    points = replay["replay_points"]
    if point_index < 0 or point_index >= len(points):
        return {"error": f"Point index {point_index} out of range [0, {len(points)-1}]"}

    point = points[point_index]
    return {
        "well_id": well_id,
        "point_index": point_index,
        "timestamp": point["timestamp"],
        "anomaly_score": point.get("anomaly_score"),
        "condition": point.get("condition"),
        "features": point.get("features_at_point", {}),
    }
