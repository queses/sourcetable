import jwt
import httpx
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings

security = HTTPBearer(auto_error=False)

# Cache JWKS per domain
_jwks_cache: dict[str, dict] = {}


def get_jwks(auth0_domain: str) -> dict:
    """Fetch Auth0 JWKS (JSON Web Key Set) for token verification (cached)"""
    if auth0_domain not in _jwks_cache:
        jwks_url = f"https://{auth0_domain}/.well-known/jwks.json"
        response = httpx.get(jwks_url, timeout=5.0)
        response.raise_for_status()
        _jwks_cache[auth0_domain] = response.json()
    return _jwks_cache[auth0_domain]


def get_signing_key(token: str, jwks: dict):
    """Get the signing key from JWKS for the token"""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    rsa_key = {}
    for key in jwks.get("keys", []):
        if key["kid"] == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
            break

    if not rsa_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find appropriate key",
        )

    return jwt.algorithms.RSAAlgorithm.from_jwk(rsa_key)


async def verify_jwt_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Verify Auth0 JWT token and return decoded payload.

    This dependency extracts and verifies the JWT token from the Authorization header.
    Returns the decoded token payload with user information.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    settings = get_settings()

    try:
        # Get JWKS (cached)
        jwks = get_jwks(settings.auth0_domain)

        # Get signing key
        signing_key = get_signing_key(token, jwks)

        # Verify and decode token
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.auth0_client_id,
            issuer=f"https://{settings.auth0_domain}/",
        )

        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )


def is_email_whitelisted(email: str) -> bool:
    """
    Check if an email is in the whitelist.

    Args:
        email: Email address to check

    Returns:
        True if email is whitelisted or whitelist is empty, False otherwise
    """
    settings = get_settings()
    whitelist_str = settings.email_whitelist.strip()

    # Empty whitelist means allow all (fail-open for development)
    if not whitelist_str:
        return True

    # Normalize email for comparison
    normalized_email = email.strip().lower()

    # Parse and normalize whitelist
    whitelist_emails = [
        e.strip().lower() for e in whitelist_str.split(",") if e.strip()
    ]

    return normalized_email in whitelist_emails
