"""Auth0 configuration and OAuth setup"""

from authlib.integrations.starlette_client import OAuth

from app.config import get_settings

settings = get_settings()

# Auth0 OAuth configuration
oauth = OAuth()

oauth.register(
    "auth0",
    client_id=settings.auth0_client_id,
    client_secret=settings.auth0_client_secret,
    client_kwargs={
        "scope": "openid profile email",
    },
    server_metadata_url=f"https://{settings.auth0_domain}/.well-known/openid-configuration",
)


def get_auth0_config():
    """Get Auth0 configuration dictionary"""
    return {
        "domain": settings.auth0_domain,
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "audience": settings.auth0_audience,
    }
