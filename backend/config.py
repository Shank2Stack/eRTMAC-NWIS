"""
backend/config.py
Application configuration loaded from environment variables / .env file.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SECRET_KEY: str = "change-this-to-a-long-random-secret-key-at-least-32-chars"
    FRONTEND_URL: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    # Paths are relative to the project root (one level above backend/)
    DATA_DIR: str = "../data/raw"
    MODELS_DIR: str = "../models"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def data_path(self) -> Path:
        return (Path(__file__).parent / self.DATA_DIR).resolve()

    @property
    def models_path(self) -> Path:
        return (Path(__file__).parent / self.MODELS_DIR).resolve()


settings = Settings()
