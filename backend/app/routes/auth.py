"""Auth routes for login, logout, callback, and profile"""

from urllib.parse import urlencode, quote

from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import RedirectResponse

from app.auth.config import get_auth0_config, oauth
from app.auth.dependencies import is_email_whitelisted
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/login")
async def login(request: Request):
    """
    Initiate login with Auth0
    Redirects user to Auth0 login page

    Query params:
        redirect: URL-encoded frontend path to redirect to after login
    """
    # Get redirect path from query params
    redirect_path = request.query_params.get("redirect", "")

    # Build callback URL with redirect path as query param
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/callback"
    if redirect_path:
        redirect_uri += f"?{urlencode({'redirect': redirect_path})}"

    # Force login prompt when there's no session to allow switching users
    # This ensures users see the login screen even if Auth0 has them logged in
    kwargs = {"prompt": "login"}

    # If audience is set, include it in the authorize request
    if settings.auth0_audience:
        kwargs["audience"] = settings.auth0_audience

    return await oauth.auth0.authorize_redirect(
        request, redirect_uri=redirect_uri, **kwargs
    )


@router.get("/callback", name="callback")
async def callback(request: Request):
    """
    Callback endpoint for Auth0 redirect
    Validates email against whitelist before allowing access
    Redirects to frontend with ID token (JWT) in URL fragment
    """
    # Get redirect path from query params
    redirect_path = request.query_params.get("redirect", "")

    # Build final redirect URL
    final_redirect_url = str(settings.frontend_url).rstrip("/")
    if redirect_path:
        # Ensure redirect_path starts with / if it's a path
        if not redirect_path.startswith("/") and not redirect_path.startswith("http"):
            redirect_path = "/" + redirect_path
        final_redirect_url += redirect_path

    # Check if user declined the authorization
    error = request.query_params.get("error")
    if error:
        # User declined or there was an error, redirect back to frontend
        return RedirectResponse(url=final_redirect_url)

    token = await oauth.auth0.authorize_access_token(request)

    # Extract userinfo and email
    userinfo = token.get("userinfo")
    if not userinfo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user information received from Auth0",
        )

    email = userinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email found in user information",
        )

    # Validate email against whitelist
    if not is_email_whitelisted(email):
        return RedirectResponse(url=final_redirect_url)

    # Get ID token (JWT) - this is what we'll use for authentication
    id_token = token.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No ID token received from Auth0",
        )

    # Build URL fragment with ID token (JWT) only
    # Format: #token=...&redirect=...
    fragment_parts = [f"token={quote(id_token)}"]
    if redirect_path:
        fragment_parts.append(f"redirect={quote(redirect_path)}")

    # Build fragment string
    fragment = "&".join(fragment_parts)

    # Redirect to frontend with token in URL fragment
    redirect_url = f"{final_redirect_url}#{fragment}"
    return RedirectResponse(url=redirect_url)


@router.get("/logout")
async def logout(request: Request):
    """
    Logout endpoint
    Redirects to Auth0 logout
    Frontend will clear localStorage tokens
    """
    # Get Auth0 config
    auth0_config = get_auth0_config()

    # Build return URL (base URL of the app)
    return_url = str(get_settings().frontend_url).rstrip("/")

    # Redirect to Auth0 logout
    return RedirectResponse(
        url=f"https://{auth0_config['domain']}/v2/logout?"
        f"client_id={auth0_config['client_id']}&"
        f"returnTo={return_url}"
    )


@router.get("/check-whitelist")
async def check_whitelist(email: str):
    """
    Check if an email is whitelisted.
    This endpoint is used by Auth0 Post-Login Action.

    Args:
        email: Email address to check

    Returns:
        JSON with 'allowed' boolean indicating if email is whitelisted
    """
    allowed = is_email_whitelisted(email)
    return {"allowed": allowed}
