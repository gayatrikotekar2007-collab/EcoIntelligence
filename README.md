# EcoIntelligence

## 1. Project overview

EcoIntelligence is an environmental investigation and decision-support platform designed to help users detect environmental change, collect evidence, investigate likely contributing factors, and evaluate possible actions.

This repository currently contains the Phase 1 foundation only. It does not implement environmental AI, simulations, reporting, or advanced GIS features yet.

## 2. Architecture overview

The project is organized as a modular monorepo with three runtime services:

- Frontend: Next.js + React + TypeScript + Tailwind CSS
- Backend API: Python 3.12 + FastAPI + SQLAlchemy + Alembic + Pydantic
- AI service: Python FastAPI skeleton for future analysis features
- Database: PostgreSQL with PostGIS for spatial capability

The backend is responsible for application logic, database access, authentication boundaries, and future environmental investigations. The AI service is intentionally isolated and kept separate from the main application logic until the product requirements are expanded.

## 3. Prerequisites

Before starting development, ensure you have:

- Python 3.12+
- Node.js 20+
- npm
- Docker Desktop or Docker Engine
- Git

## 4. Development setup

1. Clone the repository.
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Start PostgreSQL/PostGIS with Docker Compose.
4. Create and activate a Python virtual environment for the backend and AI service.
5. Install backend and frontend dependencies.
6. Start the backend, frontend, and AI service.

## 5. How to start the backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api
```

## 6. How to start the frontend

From the repository root:

```bash
cd apps/web
npm install
npm run dev
```

The frontend will run at http://localhost:3000 by default.

## 7. How to start the AI service

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/ai/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --app-dir apps/ai
```

## 8. How to start PostgreSQL/PostGIS

From the repository root:

```bash
docker compose up -d db
```

This starts a PostGIS-enabled PostgreSQL instance for local development on host port 5433. The container uses PostgreSQL port 5432 internally. Host port 5433 avoids conflicts with an existing local PostgreSQL installation.

## 9. Current project status

Current status: Phase 1 foundation only.

Implemented:
- repository structure
- backend FastAPI skeleton with configuration and health endpoint
- SQLAlchemy and Alembic configuration skeleton
- minimal Next.js + TypeScript frontend foundation
- AI service skeleton with health endpoint
- PostgreSQL/PostGIS development setup via Docker Compose
- environment-variable based configuration
- minimal backend health test

Not implemented:
- AI features
- root-cause analysis
- recommendation engine
- environmental prediction
- computer vision
- satellite analysis
- what-if simulation
- advanced GIS
- reporting
- notifications
- database schema beyond infrastructure readiness

This project is intentionally focused on foundation work and is not yet a complete product.
