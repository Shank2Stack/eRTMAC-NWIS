"""
backend/data_service.py
Loads, caches, and queries all datasets.

Design:
- Raw files are NEVER modified.
- Datasets are loaded once at startup and held in memory.
- Well DATASET has no timestamp column → used as per-well production context.
- Mud DATASET aligned by well_id + nearest timestamp (±3-hour tolerance).
- Weather / Maintenance / Vibration have no well_id linkage → available as
  standalone context only.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Singleton caches
# ─────────────────────────────────────────────────────────
_drilling_df: Optional[pd.DataFrame] = None
_well_df: Optional[pd.DataFrame] = None
_mud_df: Optional[pd.DataFrame] = None
_weather_df: Optional[pd.DataFrame] = None
_maintenance_df: Optional[pd.DataFrame] = None
_vibration_df: Optional[pd.DataFrame] = None
_gas_df: Optional[pd.DataFrame] = None

_well_ids: Optional[List[str]] = None


# ─────────────────────────────────────────────────────────
# File discovery helpers
# ─────────────────────────────────────────────────────────

def _find_file(patterns: List[str]) -> Optional[Path]:
    data_dir = settings.data_path
    for pattern in patterns:
        matches = list(data_dir.glob(pattern))
        if matches:
            return matches[0]
    return None


def _safe_load_csv(path: Path, **kwargs) -> Optional[pd.DataFrame]:
    try:
        df = pd.read_csv(path, **kwargs)
        logger.info("Loaded %s → %d rows × %d cols", path.name, len(df), len(df.columns))
        return df
    except Exception as exc:
        logger.error("Failed to load %s: %s", path.name, exc)
        return None


def _safe_load_xlsx(path: Path, **kwargs) -> Optional[pd.DataFrame]:
    try:
        df = pd.read_excel(path, **kwargs)
        logger.info("Loaded %s → %d rows × %d cols", path.name, len(df), len(df.columns))
        return df
    except Exception as exc:
        logger.error("Failed to load %s: %s", path.name, exc)
        return None


# ─────────────────────────────────────────────────────────
# Column detection helpers
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


def _parse_timestamp(df: pd.DataFrame, ts_col: str) -> pd.DataFrame:
    df[ts_col] = pd.to_datetime(df[ts_col], errors="coerce", utc=True)
    return df


def _nan_to_none(val: Any) -> Any:
    if isinstance(val, (float, np.floating)) and np.isnan(val):
        return None
    if isinstance(val, np.integer):
        return int(val)
    if isinstance(val, np.floating):
        return float(val)
    if pd.isna(val):
        return None
    return val


def _row_to_dict(row: pd.Series) -> Dict[str, Any]:
    return {k: _nan_to_none(v) for k, v in row.items()}


# ─────────────────────────────────────────────────────────
# Dataset loaders
# ─────────────────────────────────────────────────────────

def _load_drilling() -> Optional[pd.DataFrame]:
    path = _find_file(["well_drilling*.csv", "*drilling*.csv"])
    if path is None:
        logger.error("Drilling dataset not found.")
        return None
    df = _safe_load_csv(path)
    if df is None:
        return None

    well_col = _find_col(df, ["well_id", "wellid", "well"])
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if well_col is None or ts_col is None:
        logger.error("Drilling dataset missing well_id or timestamp column.")
        return None

    # Rename to canonical names
    df = df.rename(columns={well_col: "well_id", ts_col: "timestamp"})
    df = _parse_timestamp(df, "timestamp")
    df = _coerce_numeric(df, exclude=["well_id", "timestamp"])
    df = df.dropna(subset=["well_id", "timestamp"])
    df = df.drop_duplicates()
    df = df.sort_values(["well_id", "timestamp"]).reset_index(drop=True)
    return df


def _load_well() -> Optional[pd.DataFrame]:
    path = _find_file(["well_DATASET.csv", "well_dataset.csv", "well_data*.csv"])
    if path is None:
        logger.error("Well DATASET not found.")
        return None
    df = _safe_load_csv(path)
    if df is None:
        return None

    well_col = _find_col(df, ["well_id", "wellid", "well"])
    if well_col is None:
        logger.error("Well DATASET missing well_id column.")
        return None

    df = df.rename(columns={well_col: "well_id"})
    df = _coerce_numeric(df, exclude=["well_id", "well_type"])
    df = df.dropna(subset=["well_id"])
    df = df.drop_duplicates()
    return df


def _load_mud() -> Optional[pd.DataFrame]:
    path = _find_file(["mud_DATASET.xlsx", "mud_dataset.xlsx", "mud*.xlsx", "mud*.csv"])
    if path is None:
        logger.warning("Mud DATASET not found — mud features will be unavailable.")
        return None

    if path.suffix.lower() in (".xlsx", ".xls"):
        df = _safe_load_xlsx(path)
    else:
        df = _safe_load_csv(path)

    if df is None:
        return None

    well_col = _find_col(df, ["well_id", "wellid", "well"])
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if well_col is None:
        logger.warning("Mud DATASET missing well_id — mud features will be unavailable.")
        return None

    df = df.rename(columns={well_col: "well_id"})
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df = _parse_timestamp(df, "timestamp")

    df = _coerce_numeric(df, exclude=["well_id", "timestamp"])
    df = df.dropna(subset=["well_id"])
    df = df.drop_duplicates()
    if "timestamp" in df.columns:
        df = df.sort_values(["well_id", "timestamp"]).reset_index(drop=True)
    return df


def _load_weather() -> Optional[pd.DataFrame]:
    path = _find_file(["weather*.csv"])
    if path is None:
        return None
    df = _safe_load_csv(path)
    if df is None:
        return None
    date_col = _find_col(df, ["date", "datetime", "timestamp"])
    if date_col:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.rename(columns={date_col: "date"})
    return df


def _load_maintenance() -> Optional[pd.DataFrame]:
    path = _find_file(["maintenance*.csv"])
    if path is None:
        return None
    df = _safe_load_csv(path)
    if df is None:
        return None
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


def _load_vibration() -> Optional[pd.DataFrame]:
    path = _find_file(["vibration*.csv", "vibration *.csv"])
    if path is None:
        return None
    df = _safe_load_csv(path)
    if df is None:
        return None
    ts_col = _find_col(df, ["timestamp", "date", "datetime"])
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


def _load_gas() -> Optional[pd.DataFrame]:
    path = _find_file(["CH4*.csv", "*gas*.csv", "*Gas*.csv"])
    if path is None:
        return None
    df = _safe_load_csv(path, low_memory=False)
    if df is None:
        return None
    ts_col = _find_col(df, ["timestamp", "Timestamp", "date"])
    if ts_col:
        df = df.rename(columns={ts_col: "timestamp"})
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


# ─────────────────────────────────────────────────────────
# Public initialisation
# ─────────────────────────────────────────────────────────

def load_all_data() -> None:
    """Load all datasets into memory.  Called once at startup."""
    global _drilling_df, _well_df, _mud_df
    global _weather_df, _maintenance_df, _vibration_df, _gas_df
    global _well_ids

    logger.info("Loading all datasets …")
    _drilling_df = _load_drilling()
    _well_df = _load_well()
    _mud_df = _load_mud()
    _weather_df = _load_weather()
    _maintenance_df = _load_maintenance()
    _vibration_df = _load_vibration()
    _gas_df = _load_gas()

    # Build well ID list from drilling dataset (primary source)
    if _drilling_df is not None:
        _well_ids = sorted(_drilling_df["well_id"].unique().tolist())
        logger.info("Wells discovered: %d", len(_well_ids))
    else:
        _well_ids = []

    logger.info("Data loading complete.")


def is_data_loaded() -> bool:
    return _drilling_df is not None


def get_dataset_status() -> Dict[str, bool]:
    """Detailed health status for core and auxiliary datasets."""
    return {
        "drilling": _drilling_df is not None,
        "mud": _mud_df is not None,
        "well_context": _well_df is not None,
        "gas": _gas_df is not None,
        "weather": _weather_df is not None,
        "maintenance": _maintenance_df is not None,
        "vibration": _vibration_df is not None,
    }


def get_well_ids() -> List[str]:
    return _well_ids or []


# ─────────────────────────────────────────────────────────
# Mud alignment helper (strictly past-only)
# ─────────────────────────────────────────────────────────

MUD_ALIGNMENT_TOLERANCE = pd.Timedelta(hours=3)


def _get_mud_at(well_id: str, timestamp: Any) -> Dict[str, Any]:
    """
    Return mud readings at or before timestamp for the given well.
    STRICTLY PAST-ONLY: Only readings with mud_timestamp <= timestamp
    and mud_timestamp >= timestamp - MUD_ALIGNMENT_TOLERANCE are considered.
    Within this window, selects the latest available reading at or before timestamp.
    Returns {} if no valid reading exists within tolerance. Never uses future data.
    """
    if _mud_df is None or "timestamp" not in _mud_df.columns:
        return {}
    well_mud = _mud_df[_mud_df["well_id"] == well_id]
    if well_mud.empty:
        return {}

    ts = pd.to_datetime(timestamp, utc=True)
    cutoff = ts - MUD_ALIGNMENT_TOLERANCE
    valid_mud = well_mud[(well_mud["timestamp"] <= ts) & (well_mud["timestamp"] >= cutoff)]
    if valid_mud.empty:
        return {}

    latest_row = valid_mud.sort_values("timestamp").iloc[-1]
    mud_cols = [c for c in latest_row.index if c not in ("well_id", "timestamp")]
    return {c: _nan_to_none(latest_row[c]) for c in mud_cols}


# ─────────────────────────────────────────────────────────
# Well queries
# ─────────────────────────────────────────────────────────

def get_all_wells() -> List[Dict[str, Any]]:
    """Return summary info for all wells."""
    if _drilling_df is None:
        return []

    results = []
    for wid in get_well_ids():
        w_drill = _drilling_df[_drilling_df["well_id"] == wid]
        latest = w_drill.sort_values("timestamp").iloc[-1]

        prod_info: Dict[str, Any] = {}
        if _well_df is not None:
            w_prod = _well_df[_well_df["well_id"] == wid]
            if not w_prod.empty:
                last_prod = w_prod.iloc[-1]
                for col in ["oil_production", "gas_production", "water_production",
                            "well_type", "avg_downhole_pressure_bar"]:
                    if col in last_prod.index:
                        prod_info[col] = _nan_to_none(last_prod[col])

        results.append({
            "well_id": wid,
            "well_type": prod_info.get("well_type"),
            "latest_depth_m": _nan_to_none(latest.get("depth_m")),
            "latest_timestamp": str(latest["timestamp"]),
            "oil_production": prod_info.get("oil_production"),
            "gas_production": prod_info.get("gas_production"),
        })

    return results


def _well_exists(well_id: str) -> bool:
    return well_id in get_well_ids()


def get_well_summary(well_id: str) -> Optional[Dict[str, Any]]:
    """Return summary for a single well or None if not found."""
    if not _well_exists(well_id):
        return None
    for w in get_all_wells():
        if w["well_id"] == well_id:
            return w
    return None


def get_well_state(well_id: str) -> Optional[Dict[str, Any]]:
    """
    Return the latest available state for a well:
    - Latest drilling row
    - Aligned mud reading (if available)
    - Production/pressure context (latest row from well_DATASET)
    """
    if _drilling_df is None or not _well_exists(well_id):
        return None

    w_drill = _drilling_df[_drilling_df["well_id"] == well_id].sort_values("timestamp")
    if w_drill.empty:
        return None

    latest_drill = w_drill.iloc[-1]
    ts = latest_drill["timestamp"]

    # Drilling state
    drill_cols = [c for c in latest_drill.index if c not in ("well_id", "timestamp")]
    drilling = {c: _nan_to_none(latest_drill[c]) for c in drill_cols}
    drilling["timestamp"] = str(ts)

    # Mud state
    mud = _get_mud_at(well_id, ts)

    # Production state
    production: Dict[str, Any] = {}
    if _well_df is not None:
        w_prod = _well_df[_well_df["well_id"] == well_id]
        if not w_prod.empty:
            last_prod = w_prod.iloc[-1]
            for col in last_prod.index:
                if col != "well_id":
                    production[col] = _nan_to_none(last_prod[col])

    return {
        "well_id": well_id,
        "drilling": drilling,
        "mud": mud,
        "production": production,
    }


def get_well_history(well_id: str, limit: Optional[int] = 500) -> Optional[List[Dict[str, Any]]]:
    """
    Return chronological drilling history for a well.
    If limit is specified and less than total records, uniformly samples
    across the entire chronological history from start to finish.
    """
    if _drilling_df is None or not _well_exists(well_id):
        return None

    w = _drilling_df[_drilling_df["well_id"] == well_id].sort_values("timestamp")
    if w.empty:
        return []

    total_len = len(w)
    if limit is not None and total_len > limit:
        indices = np.linspace(0, total_len - 1, limit, dtype=int)
        w = w.iloc[indices]

    return [_row_to_dict(row) for _, row in w.iterrows()]


def get_well_total_records(well_id: str) -> int:
    """Return total number of chronological drilling records available for well_id."""
    if _drilling_df is None or not _well_exists(well_id):
        return 0
    return int((_drilling_df["well_id"] == well_id).sum())


def get_all_latest_features() -> Optional[pd.DataFrame]:
    """
    Build a DataFrame with one row per well — latest drilling features.
    Used by similarity engine.
    """
    if _drilling_df is None:
        return None

    feature_cols = [c for c in _drilling_df.columns
                    if c not in ("well_id", "timestamp")]
    rows = []
    for wid in get_well_ids():
        w = _drilling_df[_drilling_df["well_id"] == wid].sort_values("timestamp")
        if w.empty:
            continue
        latest = w.iloc[-1]
        row = {"well_id": wid}
        for col in feature_cols:
            row[col] = _nan_to_none(latest[col])
        rows.append(row)

    if not rows:
        return None
    return pd.DataFrame(rows)


def get_weather_latest() -> Optional[Dict[str, Any]]:
    """Return the most recent weather record (informational only)."""
    if _weather_df is None or _weather_df.empty:
        return None
    latest = _weather_df.sort_values("date").iloc[-1]
    return {k: _nan_to_none(v) for k, v in latest.items()}


def get_gas_df() -> Optional[pd.DataFrame]:
    return _gas_df


def get_vibration_df() -> Optional[pd.DataFrame]:
    return _vibration_df


def get_maintenance_df() -> Optional[pd.DataFrame]:
    return _maintenance_df


def get_drilling_df() -> Optional[pd.DataFrame]:
    return _drilling_df
