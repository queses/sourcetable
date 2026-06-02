# SourceTable Backend

FastAPI backend with AI-powered data generation.

## Stack

- FastAPI (Python 3.11)
- SQLAlchemy (async) + PostgreSQL
- Alembic migrations
- OpenRouter for AI agents

## Setup

1. **Install dependencies:**
   ```bash
   poetry install
   ```

2. **Configure environment:**
   Create `.env` file:
   ```
   cp .env.example .env
   ```

3. **Run migrations:**
   ```bash
   poetry run alembic upgrade head
   ```

4. **Start server:**
   ```bash
   poetry run uvicorn app.main:app --reload
   ```

## API

- Base URL: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- Endpoints:
  - `/api/tables/*` (CRUD for tables, columns, rows, cells)
  - `/api/auth/login` - Auth0 login endpoint
  - `/api/auth/logout` - Auth0 logout endpoint
  - `/api/auth/callback` - Auth0 OAuth callback
- Features: CSV upload, AI-powered cell generation, pagination, filtering, sorting, Auth0 authentication

## Authentication

The backend uses Auth0 for authentication. To protect routes, use the dependencies from `app.auth.dependencies`:

```python
from app.auth.dependencies import get_current_user

@router.get("/protected")
async def protected_route(user: dict = Depends(get_current_user)):
    # User is authenticated
    return {"user": user}
```
