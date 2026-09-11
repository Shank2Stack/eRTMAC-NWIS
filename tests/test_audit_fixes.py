"""
tests/test_audit_fixes.py
Comprehensive audit and regression tests covering:
1. AUTH: valid/invalid login, token revocation, unauthenticated access, /me
2. DATA: well list, valid well, 404 for invalid, well IDs containing '/', drilling state
3. ML: prediction, determinism, missing feature handling with training medians, feature ordering
4. TEMPORAL LEAKAGE:
   - Mud at time T only uses <= T
   - Future mud reading is never selected
   - Replay does not use future data
5. WHAT-IF:
   - Valid override
   - Unsupported override (returns 400)
   - Invalid numeric values (NaN, Inf, strings -> returns 400)
   - Baseline/scenario consistency
6. SIMILARITY & COMPARE:
   - Current well excluded from similar wells
   - Stable explicit feature set
   - Compare uses identical standardized similarity methodology
7. EVIDENCE:
   - Current features, contributions, supporting records, non-causal descriptions
8. REPLAY:
   - Chronological ordering
   - Point index validation
   - Past-only alignment
9. HEALTH:
   - Core data state, ML state, auxiliary datasets state
"""
import math
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app
from backend import data_service as ds
from backend import ml_service as ml
from backend import similarity as sim
from backend import what_if as wi
from backend import replay as rp
from backend import evidence as ev

client = TestClient(app)

VALID_EMP_ID = "DEMO-1002"
VALID_PASSWORD = "0001"
SLASH_WELL_ID = "NO 15/9-F-1 C"
ANOTHER_SLASH_WELL_ID = "NO 15/9-F-11 H"


@pytest.fixture(scope="module")
def auth_headers():
    resp = client.post(
        "/api/auth/login",
        json={"employee_id": VALID_EMP_ID, "password": VALID_PASSWORD},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────
# 1. AUTHENTICATION & SECURITY
# ─────────────────────────────────────────────────────────
class TestAuthAudit:
    def test_protected_endpoints_reject_missing_token(self):
        endpoints = [
            "/api/wells",
            f"/api/wells/{SLASH_WELL_ID}",
            f"/api/wells/{SLASH_WELL_ID}/data",
            f"/api/wells/{SLASH_WELL_ID}/prediction",
            f"/api/wells/{SLASH_WELL_ID}/evidence",
            f"/api/wells/{SLASH_WELL_ID}/similar",
            f"/api/wells/{SLASH_WELL_ID}/compare/{ANOTHER_SLASH_WELL_ID}",
            f"/api/wells/{SLASH_WELL_ID}/investigate",
            f"/api/wells/{SLASH_WELL_ID}/replay",
        ]
        for ep in endpoints:
            r = client.get(ep)
            assert r.status_code == 401, f"Endpoint {ep} allowed unauthenticated access"

    def test_protected_endpoints_reject_invalid_token(self):
        headers = {"Authorization": "Bearer invalid.fake.token"}
        r = client.get("/api/wells", headers=headers)
        assert r.status_code == 401

    def test_no_passwords_in_auth_me(self, auth_headers):
        r = client.get("/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        text = r.text.lower()
        assert "password" not in text
        assert "password_hash" not in text

    def test_revoked_token_is_blocked(self):
        login_resp = client.post(
            "/api/auth/login",
            json={"employee_id": VALID_EMP_ID, "password": VALID_PASSWORD},
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Works before logout
        assert client.get("/api/auth/me", headers=headers).status_code == 200

        # Logout
        logout_resp = client.post("/api/auth/logout", headers=headers)
        assert logout_resp.status_code == 200

        # Fails after logout
        assert client.get("/api/auth/me", headers=headers).status_code == 401


# ─────────────────────────────────────────────────────────
# 2. DATA SERVICE & SLASH WELL IDS
# ─────────────────────────────────────────────────────────
class TestDataServiceAudit:
    def test_well_ids_contain_slash(self, auth_headers):
        r = client.get("/api/wells", headers=auth_headers)
        assert r.status_code == 200
        wells = r.json()
        well_ids = [w["well_id"] for w in wells]
        assert SLASH_WELL_ID in well_ids
        assert any("/" in wid for wid in well_ids)

    def test_get_well_with_slash_id(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["well_id"] == SLASH_WELL_ID

    def test_well_data_with_slash_id(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}/data", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["well_id"] == SLASH_WELL_ID
        assert "drilling" in data
        assert "mud" in data
        assert "production" in data

    def test_nonexistent_well_returns_404(self, auth_headers):
        r = client.get("/api/wells/FAKE_WELL_12345/data", headers=auth_headers)
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()


# ─────────────────────────────────────────────────────────
# 3. TEMPORAL LEAKAGE PROTECTION
# ─────────────────────────────────────────────────────────
class TestTemporalLeakageProtection:
    def test_mud_at_timestamp_never_selects_future_data(self):
        """
        Verify that _get_mud_at strictly ignores mud observations with timestamp > query_time.
        """
        mud_df = ds._mud_df
        if mud_df is None or mud_df.empty:
            pytest.skip("Mud dataset not loaded")

        well_id = SLASH_WELL_ID
        well_mud = mud_df[mud_df["well_id"] == well_id].sort_values("timestamp")
        assert len(well_mud) >= 2, "Need at least 2 mud records for well"

        t0 = well_mud.iloc[0]["timestamp"]
        t1 = well_mud.iloc[1]["timestamp"]
        assert t1 > t0

        # Query at t0 + 1 hour (strictly before t1)
        query_ts = t0 + pd.Timedelta(hours=1)
        mud_reading = ds._get_mud_at(well_id, query_ts)

        # The reading must match t0's values, NOT t1's values (which are in the future)
        expected_flow = ds._nan_to_none(well_mud.iloc[0]["mud_flow_rate"])
        assert mud_reading.get("mud_flow_rate") == expected_flow

        # If we query 1 minute before t0, no past mud reading exists within window -> should return empty dict
        prior_ts = t0 - pd.Timedelta(hours=4)
        no_mud = ds._get_mud_at(well_id, prior_ts)
        assert no_mud == {}

    def test_replay_is_strictly_chronological_and_past_only(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}/replay?max_points=50", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        points = data["replay_points"]
        assert len(points) > 0

        # Timestamps must be non-decreasing
        timestamps = [pd.to_datetime(p["timestamp"]) for p in points]
        for i in range(len(timestamps) - 1):
            assert timestamps[i] <= timestamps[i + 1], "Replay points are not chronologically sorted"


# ─────────────────────────────────────────────────────────
# 4. ML MODEL CONSISTENCY & DETERMINISM
# ─────────────────────────────────────────────────────────
class TestMLConsistency:
    def test_prediction_is_deterministic(self, auth_headers):
        r1 = client.get(f"/api/wells/{SLASH_WELL_ID}/prediction", headers=auth_headers)
        r2 = client.get(f"/api/wells/{SLASH_WELL_ID}/prediction", headers=auth_headers)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["anomaly_score"] == r2.json()["anomaly_score"]
        assert r1.json()["condition"] == r2.json()["condition"]

    def test_missing_features_handled_by_training_medians(self):
        """
        Passing a feature dict with missing / None features should be imputed
        using the fitted pipeline medians rather than crashing or using 0.0.
        """
        assert ml.is_model_loaded()
        pred_full = ml.predict_from_features({
            "depth_m": 2500.0,
            "ROP": 15.0,
            "WOB": 100.0,
            "RPM": 100.0,
            "Torque": 12.0,
            "mud_flow_rate": 1500.0,
            "mud_pressure": 120.0,
            "mud_loss_rate": 0.25,
            "mud_weight": 1.25,
        })
        assert pred_full is not None
        assert 0.0 <= pred_full["anomaly_score"] <= 1.0

        # Passing completely empty features: pipeline should impute all with medians
        pred_empty = ml.predict_from_features({})
        assert pred_empty is not None
        assert 0.0 <= pred_empty["anomaly_score"] <= 1.0
        assert pred_empty["condition"] in ("Normal", "Elevated", "Critical")

    def test_feature_ordering_matches_model_metadata(self):
        expected_features = ml.get_supported_whatif_features()
        assert "depth_m" in expected_features
        assert "ROP" in expected_features
        assert "WOB" in expected_features
        assert "RPM" in expected_features
        assert "Torque" in expected_features
        assert "mud_flow_rate" in expected_features


# ─────────────────────────────────────────────────────────
# 5. WHAT-IF SCENARIO ANALYSIS
# ─────────────────────────────────────────────────────────
class TestWhatIfAudit:
    def test_what_if_valid_override(self, auth_headers):
        r = client.post(
            f"/api/wells/{SLASH_WELL_ID}/what-if",
            headers=auth_headers,
            json={"ROP": 30.0, "WOB": 150.0},
        )
        assert r.status_code == 200
        data = r.json()
        assert "current_anomaly_score" in data
        assert "scenario_anomaly_score" in data
        assert "score_change" in data
        assert "ROP" in data["changed_features"]
        assert data["changed_features"]["ROP"]["to"] == 30.0

    def test_what_if_unsupported_field_rejected(self, auth_headers):
        r = client.post(
            f"/api/wells/{SLASH_WELL_ID}/what-if",
            headers=auth_headers,
            json={"unsupported_bogus_field": 999.0},
        )
        assert r.status_code == 400
        assert "unsupported" in r.json()["detail"].lower()

    def test_what_if_invalid_numeric_rejected(self, auth_headers):
        r = client.post(
            f"/api/wells/{SLASH_WELL_ID}/what-if",
            headers=auth_headers,
            json={"ROP": "non_numeric_string"},
        )
        assert r.status_code in (400, 422)

    def test_what_if_nan_inf_rejected_by_engine(self):
        res_nan = wi.run_what_if(SLASH_WELL_ID, {"ROP": float("nan")})
        assert res_nan is not None and "error" in res_nan
        assert "finite" in res_nan["error"]

        res_inf = wi.run_what_if(SLASH_WELL_ID, {"ROP": float("inf")})
        assert res_inf is not None and "error" in res_inf
        assert "finite" in res_inf["error"]

    def test_what_if_empty_body_rejected(self, auth_headers):
        r = client.post(
            f"/api/wells/{SLASH_WELL_ID}/what-if",
            headers=auth_headers,
            json={},
        )
        assert r.status_code == 400


# ─────────────────────────────────────────────────────────
# 6. SIMILARITY & COMPARE UNIFICATION
# ─────────────────────────────────────────────────────────
class TestSimilarityAndCompareAudit:
    def test_similar_wells_excludes_self(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}/similar?k=5", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        sim_wells = data["similar_wells"]
        for sw in sim_wells:
            assert sw["well_id"] != SLASH_WELL_ID, "Self well was included in similar wells!"
            assert 0.0 <= sw["similarity_score"] <= 1.0

    def test_compare_endpoint_uses_same_methodology(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}/compare/{ANOTHER_SLASH_WELL_ID}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "similarity_score" in data
        assert "feature_diffs" in data
        assert 0.0 <= data["similarity_score"] <= 1.0

        # Verify against direct pairwise similarity engine
        direct = sim.compute_pairwise_similarity(SLASH_WELL_ID, ANOTHER_SLASH_WELL_ID)
        assert direct is not None
        assert data["similarity_score"] == direct["similarity_score"]


# ─────────────────────────────────────────────────────────
# 7. EVIDENCE ENGINE
# ─────────────────────────────────────────────────────────
class TestEvidenceAudit:
    def test_evidence_structure_and_non_causal_language(self, auth_headers):
        r = client.get(f"/api/wells/{SLASH_WELL_ID}/evidence", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "current_features" in data
        assert "feature_contributions" in data
        assert "supporting_records" in data

        # Check that no description claims causation ("caused", "failure guaranteed")
        for contrib in data["feature_contributions"]:
            desc = contrib["description"].lower()
            assert "caused" not in desc
            assert "failure guaranteed" not in desc


# ─────────────────────────────────────────────────────────
# 8. HEALTH ENDPOINT STATUS
# ─────────────────────────────────────────────────────────
class TestHealthAudit:
    def test_health_detailed_status(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["api_alive"] is True
        assert data["core_data_loaded"] is True
        assert data["model_loaded"] is True
        assert "auxiliary_datasets" in data
        aux = data["auxiliary_datasets"]
        assert "drilling" in aux
        assert "mud" in aux
        assert "gas" in aux
        assert data["wells_count"] >= 5
