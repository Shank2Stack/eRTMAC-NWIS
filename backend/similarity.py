"""
backend/similarity.py
K-Nearest Neighbours similarity across wells.

Uses the latest drilling feature vector per well.
Standardised Euclidean distance, normalised to a 0..1 similarity score.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

from backend import data_service as ds

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Explicit stable similarity feature set
# ─────────────────────────────────────────────────────────
SIMILARITY_FEATURES = ["depth_m", "ROP", "WOB", "RPM", "Torque"]

_imputer: Optional[SimpleImputer] = None
_scaler: Optional[StandardScaler] = None
_knn: Optional[NearestNeighbors] = None
_feature_df: Optional[pd.DataFrame] = None
_feature_cols: List[str] = list(SIMILARITY_FEATURES)


def _build_index() -> None:
    global _imputer, _scaler, _knn, _feature_df, _feature_cols

    df = ds.get_all_latest_features()
    if df is None or df.empty:
        logger.warning("No well feature data for similarity index.")
        return

    # Use explicit drilling feature set
    available = [c for c in SIMILARITY_FEATURES if c in df.columns]
    if not available:
        logger.warning("No standard similarity features available in drilling data.")
        return

    _feature_cols = available

    # Build numeric matrix
    X_raw = df[_feature_cols].values.astype(float)

    # Impute missing values using column median (not raw 0)
    _imputer = SimpleImputer(strategy="median")
    X_imputed = _imputer.fit_transform(X_raw)

    # Standardize so features with large scales (depth) do not dominate
    _scaler = StandardScaler()
    X_scaled = _scaler.fit_transform(X_imputed)

    n_neighbors = min(6, len(df))  # up to 5 neighbors + self
    _knn = NearestNeighbors(n_neighbors=n_neighbors, metric="euclidean")
    _knn.fit(X_scaled)

    _feature_df = df.reset_index(drop=True)
    logger.info("Similarity index built: %d wells × %d features using median imputation + StandardScaler", len(df), len(_feature_cols))


def init_similarity() -> None:
    _build_index()


def _distance_to_score(dist: float) -> float:
    """
    Convert standardized Euclidean distance to 0..1 similarity indicator (1 = identical).
    This is an operational indicator, NOT a calibrated probability.
    """
    return round(float(1.0 / (1.0 + dist)), 4)


def get_similar_wells(well_id: str, k: int = 5) -> Optional[List[Dict[str, Any]]]:
    """Return the k most similar wells to well_id (excluding self)."""
    if _knn is None or _feature_df is None or _imputer is None or _scaler is None:
        return None

    well_rows = _feature_df[_feature_df["well_id"] == well_id]
    if well_rows.empty:
        return None

    query_raw = well_rows.iloc[0][_feature_cols].values.astype(float).reshape(1, -1)
    query_imputed = _imputer.transform(query_raw)
    query_scaled = _scaler.transform(query_imputed)

    n_req = min(k + 1, len(_feature_df))
    distances, indices = _knn.kneighbors(query_scaled, n_neighbors=n_req)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        row = _feature_df.iloc[idx]
        if row["well_id"] == well_id:
            # Always exclude the query well itself
            continue
        matched = {
            f: round(float(row[f]), 4)
            for f in _feature_cols
            if pd.notna(row[f])
        }
        results.append({
            "well_id": row["well_id"],
            "similarity_score": _distance_to_score(dist),
            "distance": round(float(dist), 4),
            "matched_features": matched,
        })
        if len(results) >= k:
            break

    return results


def compute_pairwise_similarity(well_id_1: str, well_id_2: str) -> Optional[Dict[str, Any]]:
    """
    Canonical comparison between two wells using the same standardized feature space.
    Shared with the /compare endpoint to avoid duplicated or inconsistent similarity logic.
    """
    if _feature_df is None or _imputer is None or _scaler is None:
        init_similarity()
        if _feature_df is None or _imputer is None or _scaler is None:
            return None

    w1_rows = _feature_df[_feature_df["well_id"] == well_id_1]
    w2_rows = _feature_df[_feature_df["well_id"] == well_id_2]
    if w1_rows.empty or w2_rows.empty:
        return None

    r1 = w1_rows.iloc[0]
    r2 = w2_rows.iloc[0]

    v1_raw = r1[_feature_cols].values.astype(float).reshape(1, -1)
    v2_raw = r2[_feature_cols].values.astype(float).reshape(1, -1)

    v1_scaled = _scaler.transform(_imputer.transform(v1_raw))[0]
    v2_scaled = _scaler.transform(_imputer.transform(v2_raw))[0]

    # Standardized Euclidean distance
    standardized_dist = float(np.linalg.norm(v1_scaled - v2_scaled))
    similarity_score = _distance_to_score(standardized_dist)

    diffs = []
    for f in _feature_cols:
        cv = r1[f]
        hv = r2[f]
        if pd.notna(cv) and pd.notna(hv):
            c_flt = float(cv)
            h_flt = float(hv)
            diff = c_flt - h_flt
            pct = (diff / h_flt * 100) if h_flt != 0 else None
            diffs.append({
                "feature": f,
                "current_value": round(c_flt, 4),
                "historical_value": round(h_flt, 4),
                "diff": round(diff, 4),
                "pct_diff": round(pct, 2) if pct is not None else None,
            })

    return {
        "similarity_score": similarity_score,
        "standardized_distance": round(standardized_dist, 4),
        "feature_diffs": diffs,
    }
