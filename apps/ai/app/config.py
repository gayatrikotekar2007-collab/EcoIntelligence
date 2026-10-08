from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="EcoIntelligence AI")
    app_env: str = Field(default="development")
    debug: bool = Field(default=True)
    ai_service_host: str = Field(default="0.0.0.0")
    ai_service_port: int = Field(default=8001)
    ai_service_url: str = Field(default="http://localhost:8001")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
