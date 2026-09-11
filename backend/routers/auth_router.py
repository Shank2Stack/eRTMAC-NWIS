"""
backend/routers/auth_router.py
Authentication endpoints:
  POST /api/auth/login
  GET  /api/auth/me
  POST /api/auth/logout
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend import auth
from backend.schemas import CurrentUser, LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

_bearer = HTTPBearer(auto_error=False)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """
    Authenticate an employee with Employee ID + password.
    Returns JWT bearer token on success.
    Generic error on failure — does not reveal whether the ID exists.
    """
    employee = auth.authenticate_employee(payload.employee_id, payload.password)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Employee ID or Password",
        )
    token = auth.create_access_token(employee["employee_id"], employee["name"])
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        employee_id=employee["employee_id"],
        name=employee["name"],
    )


@router.get("/me", response_model=CurrentUser)
def get_me(current_user: dict = Depends(auth.get_current_user)):
    """Return safe profile of the currently authenticated employee."""
    return CurrentUser(
        employee_id=current_user["employee_id"],
        name=current_user["name"],
    )


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Revoke the current JWT token.
    The frontend should also clear its stored token.
    """
    if credentials and credentials.credentials:
        auth.revoke_token(credentials.credentials)
    return {"message": "Logged out successfully."}
