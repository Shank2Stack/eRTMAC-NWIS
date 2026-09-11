"""
ml/train.py
Master training script for eRTMAC-NWIS.

Run from the project root:
    python ml/train.py

What it does:
1. Loads drilling data → trains IsolationForest anomaly detector
2. Loads gas data → trains RandomForest gas safety classifier
3. Loads vibration data → trains RandomForest equipment health classifier
4. Saves all model artifacts to models/
5. Prints a summary

No raw files are modified.
No labels are fabricated.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Add project root to path so imports work from any cwd
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing import (
    build_feature_matrix,
    build_gas_feature_matrix,
    build_vibration_feature_matrix,
    create_drilling_preprocessor,
    load_drilling,
    load_gas,
    load_mud,
    load_vibration,
    MODELS_DIR,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _ensure_models_dir() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _save(obj: object, name: str) -> Path:
    path = MODELS_DIR / name
    joblib.dump(obj, path)
    logger.info("Saved: %s", path)
    return path


def _save_json(data: dict, name: str) -> None:
    path = MODELS_DIR / name
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Saved: %s", path)


# ─────────────────────────────────────────────────────────
# 1. Drilling Anomaly Detector (IsolationForest)
# ─────────────────────────────────────────────────────────

def train_drilling_anomaly(drilling: pd.DataFrame, mud: pd.DataFrame | None) -> dict:
    logger.info("=== Training Drilling Anomaly Detector ===")

    X, feature_cols = build_feature_matrix(drilling, mud)

    if X.empty or len(X) < 10:
        logger.error("Not enough data to train drilling model.")
        return {}

    # Canonical Preprocessor: SimpleImputer(strategy='median') + StandardScaler
    # Fitting pipeline computes and saves medians & scaling parameters together
    preprocessor = create_drilling_preprocessor()
    X_scaled = preprocessor.fit_transform(X)

    feature_medians = {
        feat: round(float(med), 4)
        for feat, med in zip(feature_cols, preprocessor.named_steps["imputer"].statistics_)
    }
    logger.info("Computed training medians for imputation: %s", feature_medians)

    # IsolationForest — unsupervised anomaly detector
    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42,
        max_samples="auto",
    )
    model.fit(X_scaled)

    # Evaluate: compute scores on training set
    scores = model.decision_function(X_scaled)
    # Remap to 0..1 anomaly score (decision_function < 0 is anomalous, > 0 is normal)
    anomaly_scores = np.clip(0.5 - (scores / 0.25), 0, 1)
    n_anomalous = int((anomaly_scores > 0.65).sum())
    n_elevated = int(((anomaly_scores > 0.35) & (anomaly_scores <= 0.65)).sum())
    n_normal = int((anomaly_scores <= 0.35).sum())

    logger.info(
        "Anomaly distribution — Normal: %d | Elevated: %d | Critical: %d",
        n_normal, n_elevated, n_anomalous,
    )

    # Save
    _save(model, "drilling_anomaly.joblib")
    _save(preprocessor, "drilling_preprocessor.joblib")

    return {
        "model_type": "IsolationForest",
        "task": "Drilling Behaviour Anomaly Detection",
        "features": feature_cols,
        "feature_medians": feature_medians,
        "training_samples": len(X),
        "n_normal": n_normal,
        "n_elevated": n_elevated,
        "n_critical": n_anomalous,
        "note": (
            "Unsupervised anomaly detection. Anomaly score 0-1 is an unusual operating-state "
            "indicator, NOT a calibrated failure probability. No labels were invented. "
            "Thresholds: Normal <= 0.35, Elevated <= 0.65, Critical > 0.65."
        ),
    }


# ─────────────────────────────────────────────────────────
# 2. Gas Safety Classifier (RandomForest)
# ─────────────────────────────────────────────────────────

def train_gas_classifier(gas: pd.DataFrame | None) -> dict:
    logger.info("=== Training Gas Safety Classifier ===")

    if gas is None:
        logger.warning("Gas dataset not available. Skipping gas classifier.")
        return {}

    X, y, feature_cols = build_gas_feature_matrix(gas)
    if X is None or y is None or len(X) < 20:
        logger.warning("Insufficient gas data for classifier. Skipping.")
        return {}

    # Subsample for speed if very large
    if len(X) > 20000:
        sample_idx = np.random.RandomState(42).choice(len(X), 20000, replace=False)
        X = X.iloc[sample_idx]
        y = y.iloc[sample_idx]

    le = LabelEncoder()
    y_enc = le.fit_transform(y.astype(str))

    # Note: Chronological / sensor records. RandomForest is scale-invariant so no scaler needed.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0)
    logger.info("Gas Classifier — weighted F1: %.4f\n%s", f1, report)

    _save(clf, "gas_classifier.joblib")
    _save(le, "gas_label_encoder.joblib")
    # Redundant gas_scaler.joblib removed: tree models do not require feature scaling.

    return {
        "model_type": "RandomForestClassifier",
        "task": "Gas Safety Classification (CH4 / H2S)",
        "features": feature_cols,
        "classes": list(le.classes_),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "weighted_f1": round(f1, 4),
        "note": "Supervised classifier on real gas sensor labels from standalone CH4&H2S dataset. Has no well_id linkage.",
    }


# ─────────────────────────────────────────────────────────
# 3. Equipment Health Classifier (RandomForest on vibration)
# ─────────────────────────────────────────────────────────

def train_vibration_health(vib: pd.DataFrame | None) -> dict:
    logger.info("=== Training Equipment Health Classifier ===")

    if vib is None:
        logger.warning("Vibration dataset not available. Skipping.")
        return {}

    X, y, feature_cols = build_vibration_feature_matrix(vib)
    if X is None or y is None or len(X) < 20:
        logger.warning("Insufficient vibration data. Skipping.")
        return {}

    if len(X) > 10000:
        sample_idx = np.random.RandomState(42).choice(len(X), 10000, replace=False)
        X = X.iloc[sample_idx]
        y = y.iloc[sample_idx]

    le = LabelEncoder()
    y_enc = le.fit_transform(y.astype(str))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf.fit(X_train_s, y_train)

    y_pred = clf.predict(X_test_s)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0)
    logger.info("Vibration Health Classifier — weighted F1: %.4f\n%s", f1, report)

    _save(clf, "vibration_health.joblib")
    _save(le, "vibration_label_encoder.joblib")
    _save(scaler, "vibration_scaler.joblib")

    return {
        "model_type": "RandomForestClassifier",
        "task": "Equipment Health Classification",
        "features": feature_cols,
        "classes": list(le.classes_),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "weighted_f1": round(f1, 4),
        "note": "Supervised classifier on equipment_health labels from vibration dataset.",
    }


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print(" eRTMAC-NWIS: ML Training Pipeline")
    print("=" * 60)
    _ensure_models_dir()

    # Load data
    logger.info("Loading datasets …")
    drilling = load_drilling()
    mud = load_mud()
    gas = load_gas()
    vib = load_vibration()

    if drilling is None:
        logger.error("Drilling dataset is required. Aborting.")
        sys.exit(1)

    logger.info("Drilling: %d rows from %d wells",
                len(drilling), drilling["well_id"].nunique())

    # Train models
    drill_meta = train_drilling_anomaly(drilling, mud)
    gas_meta = train_gas_classifier(gas)
    vib_meta = train_vibration_health(vib)

    # Save metadata
    metadata = {
        "model_version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "features": drill_meta.get("features", []),
        "drilling_anomaly": drill_meta,
        "gas_classifier": gas_meta,
        "vibration_health": vib_meta,
    }
    _save_json(metadata, "metadata.json")

    # Summary
    print("\n" + "=" * 60)
    print(" Training Summary")
    print("=" * 60)
    print(f"  Drilling anomaly detector: {'[OK]' if drill_meta else '[FAILED]'}")
    print(f"  Gas safety classifier:     {'[OK]' if gas_meta else '[SKIPPED]'}")
    print(f"  Equipment health:          {'[OK]' if vib_meta else '[SKIPPED]'}")
    print(f"\n  Features used for anomaly detection:")
    for f in drill_meta.get("features", []):
        print(f"    - {f}")
    if gas_meta:
        print(f"\n  Gas classifier F1: {gas_meta.get('weighted_f1', 'N/A')}")
    if vib_meta:
        print(f"  Equipment health F1: {vib_meta.get('weighted_f1', 'N/A')}")
    print("\n  Model artifacts saved to: models/")
    print("=" * 60)
    print("  Run the backend: uvicorn backend.main:app --reload")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
