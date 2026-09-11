"""
backend/database.py
SQLite setup — stores ONLY bcrypt-hashed employee records for auth.
Raw Emp_login.csv is never returned from any endpoint.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "employees.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the employees table if it does not exist."""
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS employees (
            employee_id TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def upsert_employee(employee_id: str, password_hash: str, name: str) -> None:
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO employees (employee_id, password_hash, name)
        VALUES (?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            name = excluded.name
        """,
        (employee_id, password_hash, name),
    )
    conn.commit()
    conn.close()


def get_employee(employee_id: str) -> sqlite3.Row | None:
    init_db()
    conn = get_connection()
    row = conn.execute(
        "SELECT employee_id, password_hash, name FROM employees WHERE employee_id = ?",
        (employee_id,),
    ).fetchone()
    conn.close()
    return row


def employee_table_populated() -> bool:
    init_db()
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
    conn.close()
    return count > 0
