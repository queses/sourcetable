# SourceTable

Run AI queries in bulk across lists of websites to investigate companies, projects, or any topic with a web presence.

SourceTable combines the flexibility of spreadsheets with the power of AI agents to automate data collection and analysis.

Built in 2 days as a pet project 🐶 Not production-ready 🚧. Inspired by [freckle.io](https://freckle.io).

## Stack

**Backend:**
- FastAPI (Python 3.11)
- SQLAlchemy (async) with PostgreSQL
- Alembic
- OpenRouter
- Auth0

**Frontend:**
- Next.js 14 (React, TypeScript)
- TanStack Query & Table
- Tailwind CSS

**Database:**
- PostgreSQL

## Features

- **Table Management**: Create, rename, and delete tables
- **Dynamic Columns**: Add columns with pre-built templates
- **Row Management**: Add, delete, and regenerate rows
- **AI-Powered Data Generation**: Automatically populate cells using OpenAI agents based on column prompts
- **CSV Import**: Upload CSV files to bulk create rows
- **Data Editing**: Edit primary column values
- **Advanced Features**: Pagination, sorting, filtering, and soft deletes

## How to Run

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ and npm
- Python 3.11+ and Poetry
- Pre-commit

### Setup

1. **Install pre-commit hooks:**
   ```bash
   pre-commit install
   ```

2. **Start PostgreSQL:**
   ```bash
   docker compose up -d
   ```

3. **Run migrations:**
   ```bash
   cd backend
   poetry install
   poetry run alembic upgrade head
   ```

4. **Set environment variables:**
   Create a `.env` file in the `backend` directory:
   ```
   DATABASE_URL=postgresql+asyncpg://user:password@localhost:5436/sourcetable_db
   OPENROUTER_API_KEY=your_api_key_here
   ```

5. **Start the application:**
   ```bash
   ./start.sh
   ```

   Or manually:
   ```bash
   # Backend (port 8008)
   cd backend
   poetry run uvicorn app.main:app --reload --port 8008

   # Frontend (port 3000)
   cd frontend
   npm install
   npm run dev
   ```

### Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8008
- API Docs: http://localhost:8008/docs
