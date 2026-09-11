"""
backend/auth.py
Employee authentication — JWT bearer tokens.

Bootstrap flow (runs at startup):
  1. Read data/raw/Emp_login.csv
  2. Bcrypt-hash each plaintext password
  3. Store in SQLite employees table
  4. Raw CSV is never returned via any API endpoint

Login flow:
  POST /api/auth/login  →  verify credentials  →  issue JWT

Column detection is automatic — no hardcoded column names beyond discovery.
"""
from __future__ import annotations

import csv
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt

from backend.config import settings
from backend import database as db

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Password hashing (using bcrypt directly for compatibility)
# ─────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        pwd_bytes = password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False

# ─────────────────────────────────────────────────────────
# JWT settings
# ─────────────────────────────────────────────────────────
ALGORITHM = "HS256"

# ─────────────────────────────────────────────────────────
# In-memory token blocklist (for logout)
# ─────────────────────────────────────────────────────────
_revoked_tokens: set[str] = set()

# ─────────────────────────────────────────────────────────
# HTTP Bearer scheme
# ─────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ─────────────────────────────────────────────────────────
# Bootstrap: seed SQLite from Emp_login.csv
# ─────────────────────────────────────────────────────────

def _discover_emp_csv() -> Optional[Path]:
    """Search data/raw for a CSV whose name contains 'emp' or 'login' (case-insensitive)."""
    data_dir = settings.data_path
    for f in data_dir.glob("*.csv"):
        lower = f.name.lower()
        if "emp" in lower or "login" in lower:
            return f
    return None


def _detect_columns(header: list[str]) -> tuple[str, str]:
    """
    Detect employee-id and password columns from actual CSV header.
    Returns (id_col, pwd_col).
    Raises ValueError if detection fails.
    """
    header_lower = [h.lower().strip() for h in header]

    # Detect ID column
    id_col = None
    for candidate in ["employee_id", "emp_id", "id", "employeeid"]:
        if candidate in header_lower:
            id_col = header[header_lower.index(candidate)]
            break
    if id_col is None:
        raise ValueError(f"Cannot detect employee ID column in: {header}")

    # Detect password column
    pwd_col = None
    for candidate in ["password", "pwd", "pass", "passwd"]:
        if candidate in header_lower:
            pwd_col = header[header_lower.index(candidate)]
            break
    if pwd_col is None:
        raise ValueError(f"Cannot detect password column in: {header}")

    return id_col, pwd_col


def _detect_name_column(header: list[str]) -> Optional[str]:
    """Try to find an optional name/full_name column."""
    header_lower = [h.lower().strip() for h in header]
    for candidate in ["name", "full_name", "fullname", "employee_name", "emp_name"]:
        if candidate in header_lower:
            return header[header_lower.index(candidate)]
    return None


def bootstrap_employees() -> None:
    """
    Read Emp_login.csv → bcrypt-hash passwords → store in SQLite.
    Only runs when the table is empty (idempotent on subsequent starts).
    """
    db.init_db()

    if db.employee_table_populated():
        logger.info("Employee table already populated — skipping bootstrap.")
        return

    emp_csv = _discover_emp_csv()
    if emp_csv is None:
        logger.error("Emp_login.csv not found. Authentication will not work.")
        return

    logger.info("Bootstrapping employee credentials from %s", emp_csv.name)

    with open(emp_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        id_col, pwd_col = _detect_columns(list(header))
        name_col = _detect_name_column(list(header))

        count = 0
        for row in reader:
            emp_id = str(row[id_col]).strip().upper()
            raw_pwd = str(row[pwd_col]).strip()
            # Derive display name — fall back to Employee ID
            if name_col and row.get(name_col, "").strip():
                name = row[name_col].strip()
            else:
                name = f"Employee {emp_id}"

            if not emp_id or not raw_pwd:
                continue

            hashed = hash_password(raw_pwd)
            db.upsert_employee(emp_id, hashed, name)
            count += 1

    logger.info("Bootstrapped %d employee records.", count)


# ─────────────────────────────────────────────────────────
# Token creation / validation
# ─────────────────────────────────────────────────────────

def create_access_token(employee_id: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": employee_id,
        "name": name,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────────────────────
# Dependency: get current authenticated user
# ─────────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if token in _revoked_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = _decode_token(token)
    return {"employee_id": payload["sub"], "name": payload.get("name", payload["sub"])}


# ─────────────────────────────────────────────────────────
# Login helper
# ─────────────────────────────────────────────────────────

def authenticate_employee(employee_id: str, raw_password: str) -> Optional[dict]:
    """
    Verify employee_id + password against the SQLite store.
    Returns safe employee dict on success, None on failure.
    NEVER reveals whether the ID exists.
    """
    if not employee_id or not raw_password:
        return None

    emp_id_normalised = employee_id.strip().upper()
    row = db.get_employee(emp_id_normalised)
    if row is None:
        # Run a dummy check to prevent timing attacks
        bcrypt.checkpw(b"dummy", b"$2b$12$e8YqJm7i0w.3U5aZg1w0..9lK5p.M2Q8k1H8w.6u2K5v9h0P1q0m.")
        return None
    if not verify_password(raw_password, row["password_hash"]):
        return None
    return {"employee_id": row["employee_id"], "name": row["name"]}


def revoke_token(token: str) -> None:
    _revoked_tokens.add(token)
