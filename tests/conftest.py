import os
import sys
from pathlib import Path
import pytest

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Ensure a SECRET_KEY exists for tests
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture(scope="session", autouse=True)
def app_session():
    """Trigger FastAPI startup lifespan (bootstrap DB, load datasets, models, similarity)."""
    with TestClient(app) as client:
        yield client
