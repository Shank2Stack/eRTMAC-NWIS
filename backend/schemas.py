"""
backend/schemas.py
All Pydantic request/response schemas.  No password fields appear in any response model.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    employee_id: str = Field(..., json_schema_extra={"example": "DEMO-1002"})
    password: str = Field(..., json_schema_extra={"example": "0001"})


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: str
    name: str


class CurrentUser(BaseModel):
    employee_id: str
    name: str


# ─────────────────────────────────────────────────────────
# WELLS
# ─────────────────────────────────────────────────────────

class WellSummary(BaseModel):
    well_id: str
    well_type: Optional[str] = None
    latest_depth_m: Optional[float] = None
    latest_timestamp: Optional[str] = None
    oil_production: Optional[float] = None
    gas_production: Optional[float] = None


class DrillingState(BaseModel):
    timestamp: Optional[str] = None
    depth_m: Optional[float] = None
    ROP: Optional[float] = None
    WOB: Optional[float] = None
    RPM: Optional[float] = None
    Torque: Optional[float] = None


class MudState(BaseModel):
    mud_flow_rate: Optional[float] = None
    mud_pressure: Optional[float] = None
    mud_loss_rate: Optional[float] = None
    mud_weight: Optional[float] = None


class WellProductionState(BaseModel):
    avg_downhole_pressure_bar: Optional[float] = None
    avg_downhole_temperature_c: Optional[float] = None
    avg_choke_size_pct: Optional[float] = None
    avg_wellhead_pressure_bar: Optional[float] = None
    avg_wellhead_temperature_c: Optional[float] = None
    dp_choke_size_bar: Optional[float] = None
    oil_production: Optional[float] = None
    gas_production: Optional[float] = None
    water_production: Optional[float] = None
    well_type: Optional[str] = None


class WellState(BaseModel):
    well_id: str
    drilling: DrillingState
    mud: MudState
    production: WellProductionState


# ─────────────────────────────────────────────────────────
# ML / PREDICTIONS
# ─────────────────────────────────────────────────────────

class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float
    description: str


class Prediction(BaseModel):
    well_id: str
    condition: str                     # "Normal" | "Elevated" | "Critical"
    anomaly_score: float               # 0.0–1.0 (higher = more anomalous)
    model_version: str
    timestamp: str
    disclaimer: str = (
        "Anomaly score produced by IsolationForest on historical drilling data. "
        "This is NOT a failure probability. Use as one input among many."
    )
    features_used: List[str]
    feature_contributions: List[FeatureContribution]


class Evidence(BaseModel):
    well_id: str
    current_features: Dict[str, Any]
    feature_contributions: List[FeatureContribution]
    supporting_records: List[Dict[str, Any]]
    note: str


class SimilarWell(BaseModel):
    well_id: str
    similarity_score: float            # 0.0–1.0 (higher = more similar)
    matched_features: Dict[str, Any]
    distance: float


class SimilarWellsResponse(BaseModel):
    well_id: str
    similar_wells: List[SimilarWell]
    method: str = "Standardised Euclidean distance on drilling feature vectors"


class FeatureDiff(BaseModel):
    feature: str
    current_value: Optional[float]
    historical_value: Optional[float]
    diff: Optional[float]
    pct_diff: Optional[float]


class CompareResponse(BaseModel):
    current_well_id: str
    historical_well_id: str
    feature_diffs: List[FeatureDiff]
    similarity_score: float
    current_condition: str
    historical_condition: str


class TimelinePoint(BaseModel):
    timestamp: str
    depth_m: Optional[float]
    ROP: Optional[float]
    WOB: Optional[float]
    RPM: Optional[float]
    Torque: Optional[float]
    anomaly_score: Optional[float]
    condition: Optional[str]


class InvestigationResponse(BaseModel):
    well_id: str
    timeline: List[TimelinePoint]
    anomaly_points: List[TimelinePoint]
    depth_range: Dict[str, float]
    note: str


class WhatIfRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    ROP: Optional[float] = None
    WOB: Optional[float] = None
    RPM: Optional[float] = None
    Torque: Optional[float] = None
    depth_m: Optional[float] = None
    mud_flow_rate: Optional[float] = None
    mud_pressure: Optional[float] = None
    mud_loss_rate: Optional[float] = None
    mud_weight: Optional[float] = None


class WhatIfResponse(BaseModel):
    well_id: str
    current_condition: str
    current_anomaly_score: float
    scenario_condition: str
    scenario_anomaly_score: float
    score_change: float
    changed_features: Dict[str, Any]
    disclaimer: str = (
        "Model estimate only. Not an operational instruction. "
        "This is a hypothetical scenario for decision support only."
    )


class ReplayPoint(BaseModel):
    timestamp: str
    depth_m: Optional[float]
    ROP: Optional[float]
    WOB: Optional[float]
    RPM: Optional[float]
    Torque: Optional[float]
    anomaly_score: Optional[float]
    condition: Optional[str]
    features_at_point: Dict[str, Any]


class ReplayResponse(BaseModel):
    well_id: str
    total_points: int
    total_available_points: Optional[int] = None
    subsampled: Optional[bool] = False
    replay_points: List[ReplayPoint]


# ─────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    system_status: str = "operational"
    api_alive: bool = True
    core_data_loaded: bool = True
    auxiliary_datasets: Dict[str, bool] = Field(default_factory=dict)
    model_loaded: bool
    data_loaded: bool
    wells_count: int
    drilling_records: int
