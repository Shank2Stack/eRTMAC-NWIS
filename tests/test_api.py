"""
tests/test_api.py
Integration tests for the eRTMAC-NWIS FastAPI backend.

Run from the project root:
    pytest tests/ -v

Tests cover:
- Auth: valid, invalid, empty credentials, token protection
- Health endpoint
- Wells list
- Well data / prediction / evidence / similar / compare / investigate / what-if / replay
"""
import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import sys

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app

client = TestClient(app)

# ─────────────────────────────────────────────────────────
# Known-good test credentials from Emp_login.csv
# ─────────────────────────────────────────────────────────
VALID_EMP_ID = "DEMO-1002"
VALID_PASSWORD = "0001"
INVALID_EMP_ID = "NOTEXIST"
INVALID_PASSWORD = "wrongpass"


@pytest.fixture(scope="module")
def auth_token():
    """Return a valid JWT for use in authenticated tests."""
    resp = client.post(
        "/api/auth/login",
        json={"employee_id": VALID_EMP_ID, "password": VALID_PASSWORD},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert "access_token" in data
    # Password must never appear in response
    assert "password" not in str(data)
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def first_well_id(auth_headers):
    resp = client.get("/api/wells", headers=auth_headers)
    assert resp.status_code == 200
    wells = resp.json()
    assert len(wells) > 0
    return wells[0]["well_id"]


# ─────────────────────────────────────────────────────────
# Health (public)
# ─────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "model_loaded" in data
        assert "data_loaded" in data
        assert data["data_loaded"] is True

    def test_health_no_secrets(self):
        resp = client.get("/api/health")
        text = resp.text
        assert "password" not in text.lower()
        assert "secret" not in text.lower()


# ─────────────────────────────────────────────────────────
# Authentication
# ─────────────────────────────────────────────────────────

class TestAuth:
    def test_valid_login(self):
        resp = client.post(
            "/api/auth/login",
            json={"employee_id": VALID_EMP_ID, "password": VALID_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["employee_id"] == VALID_EMP_ID
        # No password in response
        assert "password" not in data

    def test_invalid_password(self):
        resp = client.post(
            "/api/auth/login",
            json={"employee_id": VALID_EMP_ID, "password": INVALID_PASSWORD},
        )
        assert resp.status_code == 401
        detail = resp.json()["detail"]
        # Must not reveal whether the ID exists
        assert "Invalid Employee ID or Password" in detail

    def test_invalid_employee_id(self):
        resp = client.post(
            "/api/auth/login",
            json={"employee_id": INVALID_EMP_ID, "password": VALID_PASSWORD},
        )
        assert resp.status_code == 401
        assert "Invalid Employee ID or Password" in resp.json()["detail"]

    def test_empty_credentials(self):
        resp = client.post(
            "/api/auth/login",
            json={"employee_id": "", "password": ""},
        )
        assert resp.status_code == 401

    def test_me_authenticated(self, auth_headers):
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["employee_id"] == VALID_EMP_ID
        assert "password" not in data
        assert "password_hash" not in data

    def test_me_unauthenticated(self):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_logout(self, auth_token):
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Create a separate token for logout test
        resp = client.post(
            "/api/auth/login",
            json={"employee_id": VALID_EMP_ID, "password": VALID_PASSWORD},
        )
        logout_token = resp.json()["access_token"]
        logout_headers = {"Authorization": f"Bearer {logout_token}"}

        resp = client.post("/api/auth/logout", headers=logout_headers)
        assert resp.status_code == 200

        # Token should now be rejected
        resp = client.get("/api/auth/me", headers=logout_headers)
        assert resp.status_code == 401


# ─────────────────────────────────────────────────────────
# Wells
# ─────────────────────────────────────────────────────────

class TestWells:
    def test_wells_requires_auth(self):
        resp = client.get("/api/wells")
        assert resp.status_code == 401

    def test_list_wells(self, auth_headers):
        resp = client.get("/api/wells", headers=auth_headers)
        assert resp.status_code == 200
        wells = resp.json()
        assert isinstance(wells, list)
        assert len(wells) > 0
        for well in wells:
            assert "well_id" in well

    def test_get_well(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["well_id"] == first_well_id

    def test_invalid_well(self, auth_headers):
        resp = client.get("/api/wells/NONEXISTENT_WELL_XYZ", headers=auth_headers)
        assert resp.status_code == 404

    def test_well_data(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}/data", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["well_id"] == first_well_id
        assert "drilling" in data
        assert "mud" in data
        assert "production" in data

    def test_no_passwords_in_any_well_response(self, auth_headers, first_well_id):
        """Ensure well data responses never contain password fields."""
        for endpoint in ["", "/data"]:
            resp = client.get(f"/api/wells/{first_well_id}{endpoint}", headers=auth_headers)
            assert "password" not in resp.text.lower()


# ─────────────────────────────────────────────────────────
# ML Endpoints
# ─────────────────────────────────────────────────────────

class TestML:
    def test_prediction(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}/prediction", headers=auth_headers)
        if resp.status_code == 503:
            pytest.skip("Model not loaded — run ml/train.py first")
        assert resp.status_code == 200
        data = resp.json()
        assert "condition" in data
        assert "anomaly_score" in data
        assert 0.0 <= data["anomaly_score"] <= 1.0
        assert data["condition"] in ("Normal", "Elevated", "Critical")
        assert "disclaimer" in data
        # Must explicitly NOT call it a failure probability
        assert "failure probability" not in data.get("disclaimer", "").lower() or \
               "NOT" in data.get("disclaimer", "")

    def test_evidence(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}/evidence", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "current_features" in data
        assert "supporting_records" in data

    def test_similar_wells(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}/similar", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "similar_wells" in data
        for w in data["similar_wells"]:
            assert "well_id" in w
            assert 0.0 <= w["similarity_score"] <= 1.0

    def test_investigate(self, auth_headers, first_well_id):
        resp = client.get(f"/api/wells/{first_well_id}/investigate", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "timeline" in data
        assert isinstance(data["timeline"], list)

    def test_what_if(self, auth_headers, first_well_id):
        resp = client.post(
            f"/api/wells/{first_well_id}/what-if",
            headers=auth_headers,
            json={"ROP": 25.0, "WOB": 110.0},
        )
        if resp.status_code == 503:
            pytest.skip("Model not loaded")
        assert resp.status_code == 200
        data = resp.json()
        assert "current_anomaly_score" in data
        assert "scenario_anomaly_score" in data
        assert "disclaimer" in data

    def test_what_if_empty_body(self, auth_headers, first_well_id):
        resp = client.post(
            f"/api/wells/{first_well_id}/what-if",
            headers=auth_headers,
            json={},
        )
        assert resp.status_code == 400

    def test_replay(self, auth_headers, first_well_id):
        resp = client.get(
            f"/api/wells/{first_well_id}/replay?max_points=50",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "replay_points" in data
        assert data["total_points"] <= 50

    def test_compare(self, auth_headers):
        resp = client.get("/api/wells", headers=auth_headers)
        wells = resp.json()
        if len(wells) < 2:
            pytest.skip("Need at least 2 wells for compare test")
        w1 = wells[0]["well_id"]
        w2 = wells[1]["well_id"]
        resp = client.get(f"/api/wells/{w1}/compare/{w2}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "feature_diffs" in data
        assert "similarity_score" in data

    def test_replay_predict(self, auth_headers, first_well_id):
        resp = client.post(
            f"/api/wells/{first_well_id}/replay/predict",
            headers=auth_headers,
            json={"point_index": 0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["well_id"] == first_well_id
        assert data["point_index"] == 0
        assert "anomaly_score" in data
        assert "condition" in data

    def test_replay_predict_invalid_index(self, auth_headers, first_well_id):
        resp = client.post(
            f"/api/wells/{first_well_id}/replay/predict",
            headers=auth_headers,
            json={"point_index": 999999},
        )
        assert resp.status_code == 400
