from pydantic_settings import BaseSettings
from dotenv import load_dotenv


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    openrouter_model: str = "openai/gpt-5-mini"
    openrouter_api_key: str
    database_url: str

    # Auth0 settings
    auth0_domain: str
    auth0_client_id: str
    auth0_client_secret: str
    auth0_audience: str = ""
    secret_key: str  # For session signing
    frontend_url: str = "http://localhost:3000"  # Frontend URL for redirects

    # Email whitelist (comma-separated emails, empty string allows all)
    email_whitelist: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        load_dotenv()
        _settings = Settings()
    return _settings
