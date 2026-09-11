"""
backend/routers/wells_router.py
All well endpoints (all protected by JWT auth):

  GET  /api/wells
  GET  /api/wells/{well_id}
  GET  /api/wells/{well_id}/data
  GET  /api/wells/{well_id}/prediction
  GET  /api/wells/{well_id}/evidence
  GET  /api/wells/{well_id}/similar
  GET  /api/wells/{well_id}/compare/{historical_well_id}
  GET  /api/wells/{well_id}/investigate
  POST /api/wells/{well_id}/what-if
  GET  /api/wells/{well_id}/replay
  POST /api/wells/{well_id}/replay/predict
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel


class ReplayPredictRequest(BaseModel):
    point_index: int = 0

from backend import auth
from backend import data_service as ds
from backend import ml_service as ml
from backend import similarity as sim
from backend import evidence as ev
from backend import investigate as inv
from backend import what_if as wi
from backend import replay as rp
from backend.schemas import (
    WellSummary,
    WellState,
    DrillingState,
    MudState,
    WellProductionState,
    Prediction,
    Evidence,
    FeatureContribution,
    SimilarWell,
    SimilarWellsResponse,
    CompareResponse,
    FeatureDiff,
    InvestigationResponse,
    TimelinePoint,
    WhatIfRequest,
    WhatIfResponse,
    ReplayResponse,
    ReplayPoint,
)

router = APIRouter(
    prefix="/api/wells",
    tags=["Wells"],
    dependencies=[Depends(auth.get_current_user)],  # All routes require auth
)


def _well_or_404(well_id: str) -> None:
    if well_id not in ds.get_well_ids():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Well '{well_id}' not found.",
        )


# ─────────────────────────────────────────────────────────
# GET /api/wells
# ─────────────────────────────────────────────────────────

@router.get("", response_model=List[WellSummary])
def list_wells():
    """Return summary of all available wells."""
    if not ds.is_data_loaded():
        raise HTTPException(status_code=503, detail="Data not yet loaded.")
    return [WellSummary(**w) for w in ds.get_all_wells()]


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/data
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/data", response_model=WellState)
def get_well_data(well_id: str):
    """
    Return the latest state of the well:
    drilling snapshot + mud readings + production/pressure context.
    """
    _well_or_404(well_id)
    state = ds.get_well_state(well_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"No data for well '{well_id}'.")

    # Build typed response
    drilling_raw = state.get("drilling", {})
    mud_raw = state.get("mud", {})
    prod_raw = state.get("production", {})

    drilling = DrillingState(
        timestamp=drilling_raw.get("timestamp"),
        depth_m=drilling_raw.get("depth_m"),
        ROP=drilling_raw.get("ROP"),
        WOB=drilling_raw.get("WOB"),
        RPM=drilling_raw.get("RPM"),
        Torque=drilling_raw.get("Torque"),
    )

    mud = MudState(
        mud_flow_rate=mud_raw.get("mud_flow_rate"),
        mud_pressure=mud_raw.get("mud_pressure"),
        mud_loss_rate=mud_raw.get("mud_loss_rate"),
        mud_weight=mud_raw.get("mud_weight"),
    )

    production = WellProductionState(
        avg_downhole_pressure_bar=prod_raw.get("avg_downhole_pressure_bar"),
        avg_downhole_temperature_c=prod_raw.get("avg_downhole_temperature_c"),
        avg_choke_size_pct=prod_raw.get("avg_choke_size_pct"),
        avg_wellhead_pressure_bar=prod_raw.get("avg_wellhead_pressure_bar"),
        avg_wellhead_temperature_c=prod_raw.get("avg_wellhead_temperature_c"),
        dp_choke_size_bar=prod_raw.get("dp_choke_size_bar"),
        oil_production=prod_raw.get("oil_production"),
        gas_production=prod_raw.get("gas_production"),
        water_production=prod_raw.get("water_production"),
        well_type=prod_raw.get("well_type"),
    )

    return WellState(well_id=well_id, drilling=drilling, mud=mud, production=production)


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/prediction
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/prediction", response_model=Prediction)
def get_prediction(well_id: str):
    """
    Run anomaly detection on the latest well state.
    Returns condition, anomaly_score (0-1), and feature explanations.
    """
    _well_or_404(well_id)
    if not ml.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded. Run `python ml/train.py` first.",
        )
    result = ml.predict_for_well(well_id)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail=f"Could not produce prediction for well '{well_id}'.",
        )
    return result


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/evidence
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/evidence", response_model=Evidence)
def get_evidence(well_id: str):
    """
    Return evidence: current feature values, model contributions,
    and supporting historical records.
    """
    _well_or_404(well_id)
    result = ev.get_evidence(well_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No data for well '{well_id}'.")
    return result


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/similar
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/similar", response_model=SimilarWellsResponse)
def get_similar_wells(well_id: str, k: int = Query(default=5, ge=1, le=20)):
    """
    Return the k most similar wells based on standardised drilling features.
    """
    _well_or_404(well_id)
    results = sim.get_similar_wells(well_id, k=k)
    if results is None:
        raise HTTPException(
            status_code=503,
            detail="Similarity index not available.",
        )
    return {
        "well_id": well_id,
        "similar_wells": results,
        "method": "Standardised Euclidean distance on latest per-well drilling feature vectors",
    }


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/compare/{historical_well_id}
# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/compare/{historical_well_id}
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/compare/{historical_well_id:path}", response_model=CompareResponse)
def compare_wells(well_id: str, historical_well_id: str):
    """
    Compare current well state vs. another well's latest state.
    Uses the canonical standardized similarity calculation from similarity engine.
    """
    _well_or_404(well_id)
    _well_or_404(historical_well_id)

    pair_result = sim.compute_pairwise_similarity(well_id, historical_well_id)
    if pair_result is None:
        raise HTTPException(status_code=404, detail="State not found for one or both wells.")

    # Model conditions for both wells
    curr_cond = "N/A"
    hist_cond = "N/A"
    if ml.is_model_loaded():
        cr = ml.predict_for_well(well_id)
        hr = ml.predict_for_well(historical_well_id)
        if cr:
            curr_cond = cr.get("condition", "N/A")
        if hr:
            hist_cond = hr.get("condition", "N/A")

    return {
        "current_well_id": well_id,
        "historical_well_id": historical_well_id,
        "feature_diffs": pair_result["feature_diffs"],
        "similarity_score": pair_result["similarity_score"],
        "current_condition": curr_cond,
        "historical_condition": hist_cond,
    }


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/investigate
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/investigate", response_model=InvestigationResponse)
def investigate_well(well_id: str):
    """
    Return the full chronological investigation timeline with anomaly scores.
    No future leakage — each point uses only past data.
    """
    _well_or_404(well_id)
    result = inv.get_investigation(well_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No history for well '{well_id}'.")
    return result


# ─────────────────────────────────────────────────────────
# POST /api/wells/{well_id}/what-if
# ─────────────────────────────────────────────────────────

@router.post("/{well_id:path}/what-if", response_model=WhatIfResponse)
def what_if(well_id: str, request: WhatIfRequest):
    """
    Hypothetical scenario: override one or more drilling parameters
    and see the estimated change in anomaly condition.
    """
    _well_or_404(well_id)
    data = request.model_dump()
    overrides = data.get("overrides", data)
    overrides = {k: v for k, v in overrides.items() if v is not None}
    
    if not overrides:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one parameter to override.",
        )
    result = wi.run_what_if(well_id, overrides)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Could not run what-if analysis. Check model status.",
        )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─────────────────────────────────────────────────────────
# POST /api/wells/{well_id}/replay/predict
# ─────────────────────────────────────────────────────────

@router.post("/{well_id:path}/replay/predict")
def replay_predict(
    well_id: str,
    body: Optional[ReplayPredictRequest] = None,
    point_index: Optional[int] = Query(None),
):
    """
    Run model on a specific replay point by index.
    Supports either JSON body {"point_index": 42} or query parameter ?point_index=42.
    """
    _well_or_404(well_id)
    idx = 0
    if body is not None and body.point_index is not None:
        idx = body.point_index
    elif point_index is not None:
        idx = point_index

    result = rp.replay_predict(well_id, point_index=idx)
    if result is None:
        raise HTTPException(status_code=404, detail="Replay not available for this well.")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}/replay
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}/replay", response_model=ReplayResponse)
def get_replay(well_id: str, max_points: int = Query(default=200, ge=10, le=500)):
    """
    Return chronological replay of well history with per-point anomaly scores.
    """
    _well_or_404(well_id)
    result = rp.get_replay(well_id, max_points=max_points)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No history for well '{well_id}'.")
    return result


# ─────────────────────────────────────────────────────────
# GET /api/wells/{well_id}
# ─────────────────────────────────────────────────────────

@router.get("/{well_id:path}", response_model=WellSummary)
def get_well(well_id: str):
    """Return summary for a single well."""
    _well_or_404(well_id)
    summary = ds.get_well_summary(well_id)
    if summary is None:
        raise HTTPException(status_code=404, detail=f"Well '{well_id}' not found.")
    return WellSummary(**summary)
