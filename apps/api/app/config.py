from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = REPO_ROOT / '.env'
if not ENV_FILE.exists():
    ENV_FILE = PROJECT_ROOT / '.env'


class Settings(BaseSettings):
    app_name: str = Field(default='EcoIntelligence')
    app_env: str = Field(default='development')
    debug: bool = Field(default=True)
    secret_key: str = Field(default='DKmut6KOE2CaTy3WGyTEf6S93nkdapUKC6/IXyqKeA0=')

    api_host: str = Field(default='0.0.0.0')
    api_port: int = Field(default=8000)
    api_v1_prefix: str = Field(default='/api/v1')

    database_url: str = Field(default='postgresql+psycopg://ecointelligence:Welcome@localhost:5433/ecointelligence')

    upload_dir: str = Field(default=str(REPO_ROOT / 'data' / 'uploads'))
    max_upload_size_bytes: int = Field(default=10 * 1024 * 1024)

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore',
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
