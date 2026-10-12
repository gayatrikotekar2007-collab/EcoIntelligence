# EcoIntelligence

EcoIntelligence is an evidence-first, geospatial environmental investigation and decision-support platform. It connects field observations, multi-source evidence, geospatial mapping, competing root-cause hypotheses, remediation planning, and deterministic outcome verification into a unified, auditable workflow.

---

## 1. Product Capabilities

### Investigation Management & Ownership Isolation
- **Multi-Tenant Workspaces**: Strict per-investigator data isolation and role boundaries backed by JWT authentication and password hashing.
- **Investigation Lifecycle**: Manage investigations through structured lifecycle statuses (`ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ARCHIVED`) with query-level filtering.
- **Complete Metadata Editing**: In-place editing of investigation title, category, and description with immediate state synchronization.

### Field Observations & Evidence Collection
- **Structured Observations**: Categorized field indicators with severity levels, confidence ratings, and source classifications.
- **Evidence Provenance & Immutability**: Attach photos, field readings, and documents with immutable original files and explicit provenance (`observed`, `user_reported`, `external_source`, `inferred`, `estimated`).
- **Geographic Coordinates & Accuracy**: Capture latitude, longitude, and reported horizontal accuracy uncertainty (± meters) via device GPS or manual entry, with coordinate integrity checks.
- **Secure Image Previews**: Authenticated JWT thumbnail streaming with full object URL lifecycle cleanup on unmount and removal.

### Geospatial & Temporal Analysis
- **PostGIS Spatial Indexing**: Native geospatial geometries and location coordinates for investigations, observations, and evidence.
- **GIS Map Explorer**: Spatial inspection of investigation markers, bounding boxes, and observation clusters.
- **Visual Difference Exploration**: Deterministic pixel-level change visualization and heatmap inspection between paired Before and After evidence captures.
- **Multi-Temporal Sequence Tracking**: Chronological progression tracking across 3+ timestamped field evidence captures with spatial trajectory verification.

### Root-Cause Hypotheses & Evidence Evaluation
- **Competing Hypotheses Workspace**: Formulate alternative explanatory hypotheses for observed environmental conditions.
- **Corroborating & Refuting Evidence Links**: Associate evidence directly with hypotheses, classifying each as supporting or refuting with confidence weights.
- **Comparative Evaluation Matrix**: Side-by-side assessment of competing hypotheses against accumulated evidence.

### Remediation Action Plans & Verification
- **Action Planning**: Define targeted intervention plans linked to supported hypotheses, with priority, responsible parties, and target dates.
- **Measurable Verification Criteria**: Add and edit numeric, observation-based, boolean, or text criteria with comparison operators and target units.
- **Deterministic Verification Records**: Assess criteria against post-action observations, auto-calculating numeric pass/fail thresholds and preserving distinct action lifecycle states from verification outcomes.
- **Chronological Audit Trails**: Automated, immutable event logging for evidence additions, hypothesis evaluations, action plan changes, and verification milestones.

---

## 2. Architecture Overview

The repository is organized as a modular monorepo:

- **Frontend (`apps/web`)**: Next.js (App Router), React, TypeScript, Tailwind CSS.
- **Backend API (`apps/api`)**: Python 3.12, FastAPI, SQLAlchemy ORM, Alembic migrations, Pydantic schemas, Pillow / NumPy image processing.
- **AI Service (`apps/ai`)**: Standalone FastAPI microservice skeleton for isolated analytical extensions.
- **Spatial Database (`db`)**: PostgreSQL 16 with PostGIS spatial extension.

---

## 3. Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- Docker Desktop or Docker Engine
- Git

---

## 4. Development Setup

### 1. Database Setup
Start the PostGIS container via Docker Compose:

```bash
docker compose up -d db
```

The database runs on host port `5433` (mapped from container port `5432` to avoid local PostgreSQL conflicts).

### 2. Environment Configuration
Copy `.env.example` to `.env` in the repository root and adjust values if needed:

```bash
cp .env.example .env
```

### 3. Backend Setup
From the repository root:

```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate
pip install -r apps/api/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api
```

The API documentation is available at `http://localhost:8000/docs`.

### 4. Frontend Setup
From the repository root:

```bash
cd apps/web
npm install
npm run dev
```

The web application runs at `http://localhost:3000`.

---

## 5. Testing & Verification

### Backend Tests
Run the complete backend test suite from `apps/api`:

```bash
# Windows
cd apps/api
..\..\.venv\Scripts\python.exe -m pytest -q

# Linux / macOS
cd apps/api
pytest -q
```

### Frontend Typecheck & Build
From `apps/web`:

```bash
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

---

## 6. Working Rules & Principles

- **Evidence First**: AI suggestions and inferences are never presented as confirmed fact without transparent traceability.
- **Provenance Integrity**: Original uploaded evidence is immutable; derivation records preserve full processing history.
- **Ownership Isolation**: Every investigation belongs to its creating user; cross-tenant access is strictly denied.
- **Deterministic Verification**: Action verification outcomes reflect actual observable criteria without conflating action lifecycle status.
