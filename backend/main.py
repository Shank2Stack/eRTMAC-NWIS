"""
backend/main.py
FastAPI application entry point for eRTMAC-NWIS.

Run with:
    uvicorn backend.main:app --reload

from the project root directory (eRTMAC-NWIS/).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend import auth, data_service as ds, ml_service as ml
from backend import similarity as sim
from backend.routers import auth_router, wells_router
from backend.schemas import HealthResponse

# ─────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# Startup / Shutdown lifecycle
# ─────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ─────────────────────────────────────────
    logger.info("=== eRTMAC-NWIS Backend Starting ===")

    # 1. Bootstrap employee credentials from CSV → SQLite
    auth.bootstrap_employees()

    # 2. Load all datasets into memory
    ds.load_all_data()

    # 3. Load ML model artifacts
    ml.load_models()

    # 4. Build similarity index
    sim.init_similarity()

    logger.info("=== Startup complete. Server ready. ===")
    yield
    # ── SHUTDOWN ─────────────────────────────────────────
    logger.info("=== eRTMAC-NWIS Backend Shutting Down ===")


# ─────────────────────────────────────────────────────────
# App factory
# ─────────────────────────────────────────────────────────
app = FastAPI(
    title="eRTMAC-NWIS API",
    description=(
        "Explainable Real-Time Monitoring, Analogue Comparison and "
        "What-If Decision Support — Backend API"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─────────────────────────────────────────────────────────
# CORS — allow React dev server
# ─────────────────────────────────────────────────────────
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",   # CRA fallback
    "http://localhost:5173",   # Vite default
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(wells_router.router)


# ─────────────────────────────────────────────────────────
# Health endpoint (public — no auth required)
# ─────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """
    Public health endpoint.
    Distinguishes between API alive, core drilling data, auxiliary datasets, and ML model status.
    Does NOT expose sensitive credentials.
    """
    ds_status = ds.get_dataset_status()
    core_ok = ds_status.get("drilling", False)
    model_ok = ml.is_model_loaded()

    if core_ok and model_ok:
        status_str = "ok"
        system_status = "operational"
    elif core_ok:
        status_str = "degraded"
        system_status = "core_only_model_missing"
    else:
        status_str = "error"
        system_status = "core_data_missing"

    return HealthResponse(
        status=status_str,
        system_status=system_status,
        api_alive=True,
        core_data_loaded=core_ok,
        auxiliary_datasets=ds_status,
        model_loaded=model_ok,
        data_loaded=core_ok,
        wells_count=len(ds.get_well_ids()),
        drilling_records=len(ds.get_drilling_df()) if ds.get_drilling_df() is not None else 0,
    )


@app.get("/", tags=["Root"])
def root():
    return {
        "service": "eRTMAC-NWIS API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
