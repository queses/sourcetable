from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.routes import tables, auth
from app.exceptions import AppError
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="SourceTable API",
    description="FastAPI backend for SourceTable",
    version="0.1.0",
)

# Session middleware (must be added before CORS)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    max_age=36000,  # 1 hours
    same_site="none",  # Required for cross-origin cookies
    https_only=True,  # Secure flag (required when SameSite=None)
)

# CORS middleware for Next.js frontend (DO NOT do this in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(tables.router, prefix="/api/tables", tags=["tables"])


@app.get("/", name="root")
def read_root():
    return {"message": "App is ready", "version": "0.1.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
