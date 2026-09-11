"""
ml/preprocessing.py
Reusable data loading and preprocessing utilities.

Design rules:
- Raw files are NEVER modified.
- All operations produce new DataFrames.
- File discovery is automatic.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Path resolution
# ─────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
MODELS_DIR = PROJECT_ROOT / "models"


def _find_file(patterns: List[str]) -> Optional[Path]:
    for pattern in patterns:
        matches = list(DATA_RAW.glob(pattern))
        if matches:
            return matches[0]
    return None


# ─────────────────────────────────────────────────────────
# Generic helpers
# ─────────────────────────────────────────────────────────

def _find_col(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    lower_map = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in lower_map:
            return lower_map[cand.lower()]
    return None


def _coerce_numeric(df: pd.DataFrame, exclude: List[str]) -> pd.DataFrame:
    for col in df.columns:
        if col not in exclude:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _parse_ts(df: pd.DataFrame, col: str) -> pd.DataFrame:
    df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)
    return df


# ─────────────────────────────────────────────────────────
# Drilling data loader
# ─────────────────────────────────────────────────────────

def load_drilling() -> Optional[pd.DataFrame]:
    path = _find_file(["well_drilling*.csv", "*drilling*.csv"])
    if path is None:
        logger.error("Drilling dataset not found in %s", DATA_RAW)
        return None
    df = pd.read_csv(path)
    logger.info("Loaded drilling: %d rows × %d cols from %s", len(df), len(df.columns), path.name)

    well_col = _find_col(df, ["well_id", "wellid", "well"])
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if well_col is None or ts_col is None:
        logger.error("Drilling dataset missing required columns. Found: %s", list(df.columns))
        return None

    df = df.rename(columns={well_col: "well_id", ts_col: "timestamp"})
    df = _parse_ts(df, "timestamp")
    df = _coerce_numeric(df, exclude=["well_id", "timestamp"])
    df = df.dropna(subset=["well_id", "timestamp"])
    df = df.drop_duplicates()
    df = df.sort_values(["well_id", "timestamp"]).reset_index(drop=True)
    return df


# ─────────────────────────────────────────────────────────
# Mud data loader
# ─────────────────────────────────────────────────────────

def load_mud() -> Optional[pd.DataFrame]:
    path = _find_file(["mud_DATASET.xlsx", "mud_dataset.xlsx", "mud*.xlsx", "mud*.csv"])
    if path is None:
        logger.warning("Mud dataset not found.")
        return None
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)
    logger.info("Loaded mud: %d rows × %d cols from %s", len(df), len(df.columns), path.name)

    well_col = _find_col(df, ["well_id", "wellid", "well"])
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if well_col is None:
        logger.warning("Mud dataset missing well_id. Mud features will be skipped.")
        return None

    df = df.rename(columns={well_col: "well_id"})
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df = _parse_ts(df, "timestamp")

    df = _coerce_numeric(df, exclude=["well_id", "timestamp"])
    df = df.dropna(subset=["well_id"])
    df = df.drop_duplicates()
    if "timestamp" in df.columns:
        df = df.sort_values(["well_id", "timestamp"]).reset_index(drop=True)
    return df


# ─────────────────────────────────────────────────────────
# Merge mud features into drilling by (well_id + nearest past timestamp)
# ─────────────────────────────────────────────────────────

MUD_ALIGNMENT_TOLERANCE_HOURS = 3


def merge_mud(
    drilling: pd.DataFrame,
    mud: Optional[pd.DataFrame],
    tolerance_hours: int = MUD_ALIGNMENT_TOLERANCE_HOURS,
) -> pd.DataFrame:
    """
    Left-join mud features onto drilling rows by well_id + latest past timestamp.
    STRICTLY PAST-ONLY: Only merges mud readings with timestamp <= drilling timestamp
    and timestamp >= drilling timestamp - tolerance_hours.
    Never uses future information.
    """
    if mud is None or "timestamp" not in mud.columns or mud.empty:
        return drilling.copy()

    drill_sorted = drilling.sort_values("timestamp").copy()
    mud_sorted = mud.sort_values("timestamp").copy()

    # Drop any redundant non-feature columns from mud except merge keys
    mud_cols = [c for c in mud_sorted.columns if c not in ("well_id", "timestamp")]

    # pd.merge_asof with direction='backward' strictly enforces mud.timestamp <= drill.timestamp
    merged = pd.merge_asof(
        drill_sorted,
        mud_sorted[["well_id", "timestamp"] + mud_cols],
        on="timestamp",
        by="well_id",
        direction="backward",
        tolerance=pd.Timedelta(hours=tolerance_hours),
    )

    # Restore well_id + timestamp sort order
    merged = merged.sort_values(["well_id", "timestamp"]).reset_index(drop=True)
    return merged


# ─────────────────────────────────────────────────────────
# Gas safety data loader
# ─────────────────────────────────────────────────────────

def load_gas() -> Optional[pd.DataFrame]:
    path = _find_file(["CH4*.csv", "*gas*.csv", "*Gas*.csv"])
    if path is None:
        return None
    df = pd.read_csv(path, low_memory=False)
    logger.info("Loaded gas: %d rows × %d cols", len(df), len(df.columns))
    ts_col = _find_col(df, ["timestamp", "Timestamp"])
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


# ─────────────────────────────────────────────────────────
# Vibration data loader
# ─────────────────────────────────────────────────────────

def load_vibration() -> Optional[pd.DataFrame]:
    path = _find_file(["vibration*.csv", "vibration *.csv"])
    if path is None:
        return None
    df = pd.read_csv(path)
    logger.info("Loaded vibration: %d rows × %d cols", len(df), len(df.columns))
    ts_col = _find_col(df, ["timestamp", "date"])
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


# ─────────────────────────────────────────────────────────
# Feature matrix builder
# ─────────────────────────────────────────────────────────

def build_feature_matrix(
    drilling: pd.DataFrame,
    mud: Optional[pd.DataFrame] = None,
    mud_cols_to_include: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Build training feature matrix from drilling (+ optional mud) data.
    Returns (X_df, feature_names).
    """
    DRILL_FEATURES = ["depth_m", "ROP", "WOB", "RPM", "Torque"]
    available_drill = [c for c in DRILL_FEATURES if c in drilling.columns]

    # Merge mud if available
    if mud is not None:
        merged = merge_mud(drilling, mud)
    else:
        merged = drilling.copy()

    # Select columns
    all_feats = list(available_drill)
    if mud is not None and mud_cols_to_include is None:
        # Auto-select mud numeric columns
        possible_mud = [c for c in merged.columns
                        if c not in available_drill + ["well_id", "timestamp"]
                        and pd.api.types.is_numeric_dtype(merged[c])]
        mud_cols_to_include = possible_mud

    if mud_cols_to_include:
        for col in mud_cols_to_include:
            if col in merged.columns:
                all_feats.append(col)

    X = merged[all_feats].copy()

    # Report missing
    missing_pct = X.isnull().mean()
    for col, pct in missing_pct.items():
        if pct > 0.5:
            logger.warning("Feature %s has %.0f%% missing — dropping.", col, pct * 100)
            X = X.drop(columns=[col])
            all_feats.remove(col)

    # Coerce to float64, preserving NaNs for SimpleImputer
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").astype(float)

    logger.info("Feature matrix: %d rows × %d features: %s", len(X), len(X.columns), list(X.columns))
    return X, list(X.columns)


def create_drilling_preprocessor() -> Pipeline:
    """Canonical preprocessor pipeline: training-fitted median imputer + standard scaler."""
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])


# ─────────────────────────────────────────────────────────
# Gas feature matrix + label
# ─────────────────────────────────────────────────────────

def build_gas_feature_matrix(gas: pd.DataFrame) -> Tuple[Optional[pd.DataFrame], Optional[pd.Series], List[str]]:
    """Build X, y for gas safety classifier."""
    label_col = _find_col(gas, ["overall_gas_status", "gas_class", "h2s_status"])
    sensor_cols = ["Methane_PPM", "H2S_PPM", "H2S_Sensor_1_PPM", "H2S_Sensor_2_PPM",
                   "Temperature_C", "Humidity_Percent", "MQ2", "MQ3", "MQ5", "MQ6", "MQ7", "MQ8", "MQ135"]
    available = [c for c in sensor_cols if c in gas.columns]
    if not available:
        # Auto-detect numeric columns
        available = [c for c in gas.columns
                     if pd.api.types.is_numeric_dtype(gas[c])
                     and c not in ("Record_ID", "Sync_Index")]

    if not available or label_col is None:
        logger.warning("Gas dataset: cannot build supervised feature matrix.")
        return None, None, []

    X = gas[available].copy()
    y = gas[label_col].copy()

    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")
    X = X.fillna(X.median())

    # Keep only rows with valid labels
    mask = y.notna() & (y.astype(str).str.strip() != "")
    X = X[mask]
    y = y[mask]

    logger.info("Gas feature matrix: %d rows × %d features, %d classes",
                len(X), len(X.columns), y.nunique())
    return X, y, list(X.columns)


# ─────────────────────────────────────────────────────────
# Vibration feature matrix + label
# ─────────────────────────────────────────────────────────

def build_vibration_feature_matrix(
    vib: pd.DataFrame,
) -> Tuple[Optional[pd.DataFrame], Optional[pd.Series], List[str]]:
    """Build X, y for equipment health classifier."""
    label_col = _find_col(vib, ["equipment_health", "health", "failure_type", "machine_failure"])
    sensor_cols = ["vibration_proxy_index", "rpm", "torque_nm", "tool_wear_min"]
    available = [c for c in sensor_cols if c in vib.columns]
    if not available:
        available = [c for c in vib.columns
                     if pd.api.types.is_numeric_dtype(vib[c])
                     and c not in ("asset_id",)]

    if not available or label_col is None:
        logger.warning("Vibration dataset: cannot build supervised feature matrix.")
        return None, None, []

    X = vib[available].copy()
    y = vib[label_col].copy()

    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")
    X = X.fillna(X.median())

    mask = y.notna() & (y.astype(str).str.strip() != "")
    X = X[mask]
    y = y[mask]

    logger.info("Vibration feature matrix: %d rows × %d features, %d classes",
                len(X), len(X.columns), y.nunique())
    return X, y, list(X.columns)
