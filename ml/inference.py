"""
ml/inference.py
Standalone inference helpers for use outside the FastAPI context.
Can be imported by notebooks, scripts, or tests.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
MODELS_DIR = PROJECT_ROOT / "models"


class DrillingAnomalyPredictor:
    """Wraps the IsolationForest + scaler for offline inference."""

    def __init__(self):
        self._model = None
        self._scaler = None
        self._features: List[str] = []
        self._loaded = False

    def load(self) -> bool:
        try:
            self._model = joblib.load(MODELS_DIR / "drilling_anomaly.joblib")
            self._scaler = joblib.load(MODELS_DIR / "drilling_preprocessor.joblib")
            with open(MODELS_DIR / "metadata.json") as f:
                meta = json.load(f)
            self._features = meta.get("features", [])
            self._loaded = True
            return True
        except Exception:
            return False

    def predict(self, feature_dict: Dict[str, float]) -> Optional[Dict[str, Any]]:
        if not self._loaded:
            return None
        row = np.array([[feature_dict.get(f, np.nan) for f in self._features]], dtype=float)
        scaled = self._scaler.transform(row)
        raw = float(self._model.decision_function(scaled)[0])
        score = float(np.clip(0.5 - (raw / 0.25), 0, 1))
        if score <= 0.35:
            condition = "Normal"
        elif score <= 0.65:
            condition = "Elevated"
        else:
            condition = "Critical"
        return {"anomaly_score": round(score, 4), "condition": condition}

    @property
    def features(self) -> List[str]:
        return self._features
