# eRTMAC-NWIS — Backend, ML & Authentication

**Explainable Real-Time Monitoring, Analogue Comparison and What-If Decision Support**

> SIH 2026 MVP — FastAPI + scikit-learn backend for authorized drilling engineers.

---

## Quick Start

### 1. Virtual Environment & Dependencies

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
# Copy example configuration
cp .env.example .env
# Edit .env if needed (default development SECRET_KEY and FRONTEND_URL are pre-configured)
```

### 3. Dataset Location

Raw datasets are placed in `data/raw/` and remain strictly **read-only and untouched**:
- `well_drilling_DATASET.csv` (2,650 rows, 5 wells — primary drilling behavior)
- `well_DATASET.csv` (5,943 rows — production, pressure, temperatures, well type)
- `mud_DATASET.xlsx` (2,650 rows — mud flow rate, pressure, loss rate, weight)
- `Emp_login.csv` (50 employee records for authentication)
- `weather_DATASET_2025.csv` (informational weather data)
- `maintenance_DATASET.csv` (auxiliary predictive maintenance)
- `vibration_DATA SET.csv` (auxiliary equipment health data)
- `CH4&H2S_Gas_DATASET.csv` (gas safety classification data)

### 4. Train ML Models

```bash
python ml/train.py
```

This trains the models from `data/raw/` and saves artifacts to `models/`:
- `drilling_anomaly.joblib` (IsolationForest drilling anomaly detector)
- `drilling_preprocessor.joblib` (Canonical `Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())])` fitted on training data)
- `gas_classifier.joblib` & `gas_label_encoder.joblib` (RandomForest gas safety classifier on standalone gas sensor data)
- `vibration_health.joblib`, `vibration_label_encoder.joblib`, `vibration_scaler.joblib` (auxiliary equipment health model)
- `metadata.json` (feature names, version, thresholds, metrics, training medians)

### 5. Start the Backend API

```bash
uvicorn backend.main:app --reload
```

Server starts at `http://localhost:8000` (or configured port):
- Interactive Swagger UI: `http://localhost:8000/docs`
- Interactive ReDoc: `http://localhost:8000/redoc`
- Public Health Check: `http://localhost:8000/api/health`

### 6. Run the Comprehensive Test Suite

```bash
python -m pytest -v
```

All **47 automated tests** pass covering:
- **Authentication**: valid/invalid login, empty credentials, unauthenticated access blocking, token revocation, `/me` privacy
- **Data Service**: well list, well data, real well IDs containing `/` (`NO 15/9-F-1 C`), 404 handling
- **Temporal Leakage**: mud alignment strictly past-only ($\le T$), future readings never selected, replay strictly chronological
- **ML Consistency**: deterministic inference, canonical pipeline imputation with training medians (no 0.0 replacement), feature ordering
- **What-If Analysis**: valid overrides, rejection of non-numeric / NaN / Inf / unsupported fields (HTTP 400), baseline/scenario consistency
- **Similarity & Comparison**: self excluded from similar wells, stable feature set, standardized distance, identical methodology in `/compare`
- **Evidence**: non-causal explainability wording, standardized distance for supporting records
- **Health**: detailed status distinguishing API alive, core drilling data, auxiliary datasets, and ML model status

---

## Employee Login

Employee credentials are sourced from `data/raw/Emp_login.csv`.

On first startup, passwords are bcrypt-hashed and stored in SQLite. The raw CSV is never exposed through any API endpoint.

**Example login:**
```json
POST /api/auth/login
{
  "employee_id": "DEMO-1002",
  "password": "0001"
}
```

---

## API Reference

All `/api/wells/*` endpoints require a `Bearer` JWT token.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Employee login → JWT |
| GET | `/api/auth/me` | Current user info (no password) |
| POST | `/api/auth/logout` | Revoke token |

### Wells
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wells` | List all wells |
| GET | `/api/wells/{well_id}` | Well summary |
| GET | `/api/wells/{well_id}/data` | Latest drilling + mud + production state |
| GET | `/api/wells/{well_id}/prediction` | Anomaly score + condition + explanation |
| GET | `/api/wells/{well_id}/evidence` | Feature evidence + supporting records |
| GET | `/api/wells/{well_id}/similar` | Similar wells (KNN on feature vectors) |
| GET | `/api/wells/{well_id}/compare/{hist_id}` | Side-by-side feature comparison |
| GET | `/api/wells/{well_id}/investigate` | Chronological timeline + anomaly history |
| POST | `/api/wells/{well_id}/what-if` | Hypothetical scenario analysis |
| GET | `/api/wells/{well_id}/replay` | Full chronological replay with scores |
| POST | `/api/wells/{well_id}/replay/predict` | Score a specific replay point |

### Health (public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System status |

---

## Frontend Integration Guide (React + Vite + TypeScript)

### Core User Flow
```
LOGIN (Emp ID + Password)
  ↓
GET /api/wells (List available wells)
  ↓
User selects well (e.g. "NO 15/9-F-1 C")
  ↓
WELL COCKPIT:
  ├── GET /api/wells/{well_id}/data         (Drilling snapshot + Mud + Production)
  ├── GET /api/wells/{well_id}/prediction   (Anomaly score + condition + explanations)
  ├── GET /api/wells/{well_id}/evidence     (Feature contributions + nearest supporting rows)
  ├── GET /api/wells/{well_id}/similar      (Top K historically similar wells via KNN)
  ├── GET /api/wells/{well_id}/compare/{id} (Side-by-side metric diff with analogue)
  ├── GET /api/wells/{well_id}/investigate  (Chronological timeline & past anomaly points)
  ├── POST /api/wells/{well_id}/what-if     (Hypothetical parameter override & score change)
  ├── GET /api/wells/{well_id}/replay       (Chronological replay frames)
  └── POST /api/wells/{well_id}/replay/predict (Score specific replay point by index)
```

### Important Frontend Notes:
1. **Authentication Token**: Send `Authorization: Bearer <token>` in the HTTP headers for all `/api/wells/*` requests.
2. **Well IDs with Slashes**: Real well IDs contain spaces and slashes (e.g., `NO 15/9-F-1 C`). In TypeScript/fetch/axios, use standard template literals or `encodeURIComponent(well_id)`:
   ```typescript
   const res = await fetch(`/api/wells/${encodeURIComponent(well_id)}/prediction`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   ```
3. **Condition Classification**:
   - `Normal`: `anomaly_score <= 0.35`
   - `Elevated`: `0.35 < anomaly_score <= 0.65`
   - `Critical`: `anomaly_score > 0.65`
4. **What-If Disclaimer**: Always present the backend disclaimer prominently in the What-If UI:
   *"Model estimate only. Not an operational instruction."*

---

## ML Design & Operational Semantics

### Primary Model: IsolationForest (Drilling Anomaly Detection)
- **Task:** Unsupervised operational anomaly indicator on drilling behavior
- **Features:** `depth_m`, `ROP`, `WOB`, `RPM`, `Torque`, `mud_flow_rate`, `mud_pressure`, `mud_loss_rate`, `mud_weight`
- **Output:** `anomaly_score` (0.0–1.0) and `condition` (`Normal` ≤ 0.35, `Elevated` ≤ 0.65, `Critical` > 0.65)
- **CRITICAL NOTE:** The anomaly score represents unusual operating states relative to the training distribution. It is **NOT** a calibrated probability of failure, accident probability, or guaranteed future outcome.
- **Preprocessing Pipeline:** A unified scikit-learn pipeline with `SimpleImputer(strategy='median')` and `StandardScaler()` is fitted on the training dataset and persisted to `models/drilling_preprocessor.joblib`. Exactly the same pipeline and training medians are reused across all inference paths (predict, what-if, replay, investigate). Missing values are never replaced with arbitrary 0.0.

### Temporal Leakage Protection (Causal Integrity)
- **Past-Only Mud Alignment:** When matching mud data at timestamp $T$, the system strictly queries mud observations with `timestamp <= T` and `timestamp >= T - 3h`, selecting the latest available past reading. Future readings ($> T$) are never accessed.
- **Replay & Timeline:** Replay frames and investigation timelines query historical points chronologically and compute anomaly indicators using only data available up to each point.

### Auxiliary Models (Standalone Context)
- **Gas Safety Classifier** (RandomForest): Trained on standalone `CH4&H2S_Gas_DATASET.csv` using sensor columns. Note: This dataset contains no `well_id` and is never conflated with well-specific drilling data.
- **Equipment Health Classifier** (RandomForest): Trained on `vibration_DATA SET.csv` as an auxiliary equipment-health model.

### Not Used as Well Models
| Dataset | Reason |
|---------|--------|
| `weather_DATASET_2025.csv` | Standalone weather observations; no `well_id` relationship |
| `maintenance_DATASET.csv` | Generic machinery dataset with `asset_id`; not Oil India well data |

---

## Project Structure

```
eRTMAC-NWIS/
├── backend/
│   ├── main.py              # FastAPI app factory + startup lifecycle
│   ├── auth.py              # Auth bootstrap + JWT + login logic
│   ├── config.py            # Environment settings
│   ├── database.py          # SQLite (bcrypt-hashed employee credentials only)
│   ├── schemas.py           # All Pydantic models
│   ├── data_service.py      # Dataset loading, caching, past-only mud queries
│   ├── ml_service.py        # Model loading, pipeline inference, non-causal explainability
│   ├── similarity.py        # KNN well similarity & pairwise canonical compare
│   ├── evidence.py          # Evidence package & standardized supporting records
│   ├── investigate.py       # Chronological investigation timeline
│   ├── what_if.py           # Hypothetical scenario analysis with strict validation
│   ├── replay.py            # Chronological replay with past-only alignment
│   ├── requirements.txt
│   └── routers/
│       ├── auth_router.py   # /api/auth/login, /api/auth/me, /api/auth/logout
│       └── wells_router.py  # All /api/wells/* routes (supports well IDs with '/')
│
├── ml/
│   ├── preprocessing.py     # Data loading, merge_mud (past-only), preprocessor pipeline
│   ├── train.py             # Master training script
│   └── inference.py         # Standalone inference class
│
├── data/
│   └── raw/                 # Original datasets (STRICTLY READ-ONLY AND UNTOUCHED)
│
├── models/                  # Generated by ml/train.py
│   ├── drilling_anomaly.joblib
│   ├── drilling_preprocessor.joblib
│   ├── gas_classifier.joblib
│   ├── gas_label_encoder.joblib
│   ├── vibration_health.joblib
│   ├── vibration_label_encoder.joblib
│   ├── vibration_scaler.joblib
│   └── metadata.json
│
├── tests/
│   ├── conftest.py
│   ├── test_api.py          # Baseline integration tests
│   └── test_audit_fixes.py  # Comprehensive audit and regression tests
│
├── .env.example
├── .gitignore
├── employees.db             # Local SQLite credential store
├── README.md
└── requirements.txt
```

---

## Security

- Passwords are **bcrypt-hashed** before storage; the raw CSV is never returned by any API
- JWT tokens expire after 8 hours
- Revoked tokens (logout) are blocked server-side
- All well data endpoints require authentication
- CORS is restricted to configured frontend origins
- Secrets are loaded from `.env` — never hardcoded

---

## Data Integrity

- Raw files in `data/raw/` are **never modified**
- No sensor data, events, or outcomes are fabricated
- Anomaly scores are clearly labelled as model estimates, not real-world probabilities
- Dataset relationships are only used where a defensible join key exists (`well_id`)
