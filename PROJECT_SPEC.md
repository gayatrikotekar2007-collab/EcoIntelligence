# 🌍 ECOINTELLIGENCE

### Environmental Intelligence, Investigation & Action Platform

**Project Type:** Software-only, public-facing environmental technology platform
**Target Users:** Individuals, households, communities, NGOs, researchers, environmental organizations, businesses, schools, farmers and other users
**Development Environment:** VS Code + GitHub Copilot + ChatGPT
**Status:** Initial Development

---

# 1. PRODUCT VISION

EcoIntelligence is a software platform that helps people:

> **Detect environmental changes → investigate them → understand possible causes → assess risk → decide what to do → verify the result.**

The platform must work independently of any college, institution or proprietary organizational database.

It should be capable of being used anywhere in the world, subject to the availability of relevant public data sources.

This is intended to become a serious portfolio/product project rather than a basic academic CRUD application.

---

# 2. CORE DIFFERENTIATOR

EcoIntelligence is NOT primarily:

* a carbon calculator
* a waste-management app
* an environmental complaint system
* an awareness website
* a generic sustainability dashboard
* an AI chatbot about the environment
* a simple image classifier

The core concept is:

> **Environmental investigation and decision support.**

The platform should connect evidence, historical information, geospatial information, AI analysis, possible causes, recommendations and verification into one workflow.

### Core lifecycle

```text
DETECT
   ↓
COLLECT EVIDENCE
   ↓
INVESTIGATE
   ↓
UNDERSTAND
   ↓
ASSESS RISK
   ↓
RECOMMEND ACTION
   ↓
VERIFY
   ↓
STORE ENVIRONMENTAL MEMORY
```

---

# 3. CORE MODULES

## 3.1 ECO-EYE

### Environmental Change Detection

Eco-Eye analyzes environmental evidence and identifies possible changes.

Potential inputs:

* Before/after photographs
* User-uploaded photographs
* Public imagery
* Geospatial data
* Environmental datasets

Potential detections:

* Vegetation change
* Water-body change
* Construction/land-use change
* Visible waste accumulation
* Environmental damage
* Other measurable visual changes

The system must clearly distinguish between:

* Observed
* Estimated
* Predicted
* Simulated
* User-reported
* AI-inferred

AI inference must never be presented as confirmed fact.

---

# 4. ECO-FORENSICS

### Environmental Investigation Workspace

Users can create environmental investigations.

Example:

> "Investigate vegetation loss in this area."

An investigation should contain:

* Title
* Description
* Location
* Date
* Evidence
* Images
* Timeline
* Environmental indicators
* Observations
* Possible causes
* Risk assessment
* Recommendations
* Actions taken
* Verification evidence
* Sources
* Limitations

The user should be able to return to an investigation later.

---

# 5. ECO-CAUSE

### Root-Cause Analysis

Eco-Cause attempts to determine **possible contributing factors** behind an environmental problem.

For example:

```text
Repeated waste accumulation
        ↓
Collection frequency?
        ↓
Nearby commercial activity?
        ↓
Bin availability?
        ↓
Accessibility?
        ↓
Time/season patterns?
        ↓
Weather?
        ↓
Historical incidents?
```

The system should provide:

### Observed problem

What is actually known?

### Evidence

What evidence is available?

### Possible causes

What factors could explain it?

### Confidence

How strong is the evidence?

### Missing information

What additional data would improve the analysis?

### Suggested investigation

What should the user check next?

Never present a hypothesis as a proven cause unless reliable evidence supports it.

---

# 6. ECO-ACT

### Action Recommendation Engine

After investigating an issue, the system recommends possible actions.

Recommendations should consider:

* Environmental impact
* Cost
* Time
* Difficulty
* User constraints
* Location
* Urgency
* Available resources

Users should be able to specify constraints.

Example:

> Budget: ₹500
> Time: 2 hours
> Goal: reduce local waste

The recommendation engine should identify feasible actions.

Each recommendation should explain:

* Why it was recommended
* Expected benefit
* Estimated cost
* Required time
* Difficulty
* Confidence
* Assumptions
* Alternatives

---

# 7. ENVIRONMENTAL MEMORY

EcoIntelligence should maintain a historical record for locations.

A location can accumulate:

* Observations
* Environmental events
* Images
* Investigations
* Measurements
* Predictions
* Actions
* Verification results

The system should generate a timeline such as:

```text
2021
Vegetation detected

2023
Construction detected

2024
Vegetation decline observed

2025
Multiple environmental observations

2026
Current condition
```

The AI may identify patterns, but must distinguish correlation from causation.

---

# 8. GLOBAL ENVIRONMENTAL MAP

Provide an interactive map.

Possible layers:

* Environmental observations
* Investigations
* Waste
* Water
* Vegetation
* Pollution
* Flooding
* Heat
* Biodiversity
* Environmental changes

Users should be able to:

* Search locations
* Select locations
* Drop pins
* Create observations
* View nearby investigations
* Filter layers
* Open environmental events
* View historical information

The architecture must support global locations.

Do not hard-code the application around a college or a single city.

---

# 9. AI ENVIRONMENTAL INVESTIGATOR

The platform should include an AI assistant that works with application data.

Users may ask:

* "What changed here?"
* "Why might this have happened?"
* "What evidence is missing?"
* "What should I investigate next?"
* "What actions could reduce the problem?"
* "Compare this location with its previous condition."
* "Generate an environmental investigation report."

The AI must use available application data and trusted sources.

It must not invent measurements, sources, environmental events or statistics.

Important conclusions should expose:

* Evidence
* Assumptions
* Confidence
* Data source
* Limitations

---

# 10. WHAT-IF SIMULATOR

Build a scenario-based simulation system.

Users can modify variables and compare:

### CURRENT STATE

vs.

### PROPOSED STATE

Potential scenarios:

* Increase vegetation
* Change waste collection frequency
* Add recycling points
* Reduce vehicle activity
* Add rainwater harvesting
* Change water consumption
* Change energy consumption
* Modify green coverage

Simulation outputs must be explicitly labelled as:

> Estimated / Simulated

The system must never present simulation results as measured real-world outcomes.

The simulation engine should be modular so improved scientific models can be added later.

---

# 11. IMPACT VERIFICATION

After an action is taken, users can submit evidence.

Examples:

* Photograph
* Measurement
* Observation
* Document
* Timestamp
* Location

The system compares available before/after evidence.

Example:

```text
BEFORE
Waste accumulation detected

ACTION
Cleanup performed

AFTER
New image submitted

VERIFICATION
Evidence indicates significant visible improvement
```

Do not automatically claim an environmental problem is solved merely because two images differ.

---

# 12. DATA STRATEGY

The system should support multiple data categories.

## User-generated data

* Observations
* Images
* Measurements
* Reports
* Investigation evidence
* Actions
* Verification

## Public/open data

Where legally and technically available:

* Satellite/geospatial data
* Weather
* Environmental datasets
* Open government datasets
* Biodiversity datasets
* Other relevant open datasets

Build a data-source abstraction layer.

Do not tightly couple the entire application to one external provider.

All API keys must use environment variables.

If an external API is unavailable during development, provide a clean mock provider for development/demo mode.

Never silently replace real data with fake data in production mode.

---

# 13. TECHNOLOGY STACK

Use the following stack unless there is a strong technical reason to change it.

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

Backend:
- Python 3.12+
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- PostgreSQL
- PostGIS

AI:
- Python
- FastAPI-based AI service initially

## Database

* PostgreSQL
* PostGIS

## AI/ML

* Python
* Appropriate machine-learning/computer-vision libraries

## Maps

* OpenStreetMap-compatible data
* MapLibre or another appropriate open-source mapping library

## Storage

Use an object-storage abstraction for uploaded images/evidence.

## Development

* Git
* GitHub
* Docker where useful
* pytest
* appropriate frontend testing tools

---

# 14. DATABASE CONCEPTS

The database will eventually need entities such as:

```text
User
Role
Location
Observation
Evidence
Image
EnvironmentalEvent
Investigation
InvestigationTimeline
EnvironmentalIndicator
CauseHypothesis
RiskAssessment
Recommendation
Action
ActionVerification
EnvironmentalSnapshot
Simulation
SimulationScenario
DataSource
Notification
AuditLog
```

Do not blindly create every table immediately.

Design the schema according to actual requirements during implementation.

Use:

* Foreign keys
* Constraints
* Appropriate indexes
* Geospatial indexes
* Timestamps
* Audit fields
* Appropriate soft deletion where required

---

# 15. USER ROLES

Support a flexible role system.

Initial roles:

* Individual
* Community member
* Researcher
* NGO/organization
* Business
* Administrator

Do not unnecessarily restrict environmental observations to organizations.

The platform should remain useful to an ordinary person.

---

# 16. PRIVACY

Environmental data may contain sensitive location information.

Therefore:

* Private observations must remain private unless shared
* Exact location must not automatically become publicly visible
* Uploaded images should be handled securely
* Consider EXIF metadata/privacy risks
* Users should control sharing where appropriate
* Administrative access must be logged

---

# 17. SECURITY

Treat the project as a real production application.

Implement appropriate:

* Authentication
* Authorization
* Input validation
* Secure file uploads
* File-type validation
* API security
* Rate limiting
* SQL injection prevention
* XSS prevention
* CSRF protection where applicable
* Secure secrets
* Audit logs

Never hard-code:

* API keys
* Passwords
* JWT secrets
* Database credentials

Use environment variables.

---

# 18. UI/UX

The interface should look like a modern environmental intelligence product.

Avoid:

* Generic student dashboards
* Excessive cards
* Childish environmental graphics
* Overuse of green
* Fake-looking AI interfaces
* Unnecessary animations
* Template-like CRUD screens

Preferred visual direction:

* Modern
* Scientific
* Clean
* Data-oriented
* Professional
* Accessible
* Responsive

Important pages:

1. Landing page
2. Authentication
3. Dashboard
4. Environmental Map
5. Create Observation
6. Observation Details
7. Investigation Workspace
8. Evidence Viewer
9. Environmental Timeline
10. Eco-Eye Analysis
11. Eco-Cause Analysis
12. Eco-Act Recommendations
13. What-if Simulator
14. Impact Verification
15. AI Investigator
16. Reports
17. Profile
18. Settings
19. Admin

---

# 19. DEMO MODE

Create a clear separation between:

### DEMO MODE

Can use seeded fictional/demo data.

### REAL MODE

Uses real user-generated or external data.

Never present fictional demo data as real environmental information.

---

# 20. SCIENTIFIC INTEGRITY

Every important environmental value should have metadata where appropriate:

* Unit
* Method
* Source
* Timestamp
* Data type
* Confidence
* Limitations

The system must distinguish:

```text
OBSERVED
ESTIMATED
PREDICTED
SIMULATED
USER-REPORTED
AI-INFERRED
```

Do not make unsupported scientific claims.

If a model provides only an approximation, label it clearly.

---

# 21. REPORT GENERATION

Allow users to generate professional environmental investigation reports.

Report sections:

* Executive summary
* Problem
* Location
* Evidence
* Timeline
* Map
* Environmental analysis
* Possible causes
* Risk
* Recommendations
* Actions
* Verification
* Data sources
* Assumptions
* Limitations

Reports should be useful for:

* NGOs
* researchers
* communities
* environmental organizations
* businesses
* educational projects

---

# 22. ARCHITECTURAL PRINCIPLES

Follow these principles throughout development:

### Modularity

Features should be independently maintainable.

### Separation of concerns

Frontend, backend, AI and data layers should remain properly separated.

### API-first

Important functionality should be accessible through well-designed APIs.

### Replaceability

External APIs and AI providers should be replaceable.

### Testability

Business logic should be testable without requiring the entire application.

### Observability

Important errors and events should be logged.

### Security by default

Never assume a development shortcut is acceptable in production.

### Explainability

AI-generated environmental conclusions should provide evidence and limitations.

---

# 23. DEVELOPMENT RULES FOR GITHUB COPILOT

GitHub Copilot is an implementation assistant, NOT the sole system architect.

Do NOT ask Copilot to generate the entire application at once.

Work feature-by-feature.

Before implementing a major feature:

1. Understand the requirements.
2. Identify affected components.
3. Check existing code.
4. Propose the implementation.
5. Implement only the requested scope.
6. Run tests.
7. Report errors.
8. Fix errors.
9. Avoid unrelated refactoring.

Never rewrite the entire project unless explicitly instructed.

Never delete working functionality without permission.

Never invent APIs or library capabilities.

If uncertain, ask for clarification instead of making major architectural assumptions.

---

# 24. DEVELOPMENT PHASES

## Phase 0 — Architecture

* Requirements
* Architecture
* Database plan
* API plan
* Folder structure
* Development standards

## Phase 1 — Foundation

* Repository
* Frontend
* Backend
* Database
* Configuration
* Docker where appropriate
* Health checks
* Testing setup

## Phase 2 — Authentication

* Registration
* Login
* Sessions/tokens
* Roles
* Authorization

## Phase 3 — Location & Map

* Map
* Location search
* Coordinates
* Environmental markers

## Phase 4 — Observations

* Create observation
* Upload evidence
* Categories
* Privacy
* Observation details

## Phase 5 — Investigations

* Investigation creation
* Timeline
* Evidence
* Case management

## Phase 6 — Eco-Eye

* Image comparison
* Change detection
* Visual analysis

## Phase 7 — Eco-Cause

* Evidence analysis
* Cause hypotheses
* Confidence
* Missing evidence

## Phase 8 — Eco-Act

* Recommendation engine
* User constraints
* Action tracking

## Phase 9 — Environmental Memory

* Historical snapshots
* Timeline
* Pattern detection

## Phase 10 — AI Investigator

* Conversational investigation
* Retrieval of relevant application data
* Evidence-based responses

## Phase 11 — What-if Simulator

* Scenario creation
* Simulation engine
* Comparison

## Phase 12 — Impact Verification

* Before/after evidence
* Verification logic
* Outcome tracking

## Phase 13 — Reporting

* Investigation reports
* Data/source references
* Export

## Phase 14 — Production Readiness

* Security audit
* Performance
* Testing
* Documentation
* Deployment

---

# 25. TESTING REQUIREMENTS

Include:

* Unit tests
* Integration tests
* API tests
* Frontend tests
* Database tests
* Authentication tests
* Authorization tests
* File-upload tests
* AI/ML evaluation
* Error handling tests
* Edge-case testing
* Security testing
* Performance testing

Every major feature must have tests.

---

# 26. DOCUMENTATION

Maintain:

```text
README.md
PROJECT_SPEC.md
ARCHITECTURE.md
DATABASE.md
API.md
AI_ML.md
DATA_SOURCES.md
SECURITY.md
TESTING.md
DEPLOYMENT.md
```

Documentation must reflect the actual implementation.

Do not write documentation claiming features exist when they do not.

---

# 27. RESUME OBJECTIVE

The finished project should allow legitimate discussion of:

* Full-stack development
* System design
* REST APIs
* PostgreSQL
* PostGIS
* GIS
* Computer vision
* Machine learning
* AI-assisted reasoning
* Recommendation systems
* Environmental data processing
* Simulation
* Authentication
* Security
* Testing
* Docker
* Cloud deployment
* Data pipelines

Do not optimize for buzzwords.

Every technology used must solve a real technical problem.

---

# 28. PROJECT QUALITY STANDARD

The final system should feel like a serious early-stage technology product.

Avoid:

* Fake AI
* Fake statistics
* Fake environmental claims
* Hard-coded dashboards
* Dead buttons
* Placeholder functionality presented as complete
* Unnecessary technologies
* Excessive complexity without value

Prefer:

* Working features
* Explainable calculations
* Reliable data handling
* Clear architecture
* Good UX
* Strong documentation
* Reproducible setup
* Automated tests
* Meaningful AI

---

# 29. IMPORTANT RULE FOR CHATGPT + COPILOT WORKFLOW

ChatGPT is responsible for:

* Product architecture
* Feature planning
* Technical decisions
* Task decomposition
* Reviewing implementation
* Debugging strategy
* Code-quality review
* AI/ML reasoning
* System-design review

GitHub Copilot is responsible for:

* Implementing clearly defined tasks
* Editing project files
* Generating boilerplate
* Writing tests
* Refactoring within approved scope
* Explaining code when requested

The human developer remains responsible for:

* Understanding the code
* Running the application
* Testing
* Reviewing changes
* Making final decisions

---

# 30. FIRST DEVELOPMENT INSTRUCTION

When development begins, DO NOT generate the complete project.

First produce:

1. Finalized architecture
2. Folder structure
3. MVP definition
4. Database design for MVP
5. API design for MVP
6. Development environment requirements
7. Phase 1 implementation plan

Then wait for the next implementation task.

---

# PROJECT PRINCIPLE

The fundamental question EcoIntelligence should answer is:

> **“Something in my environment is changing. What happened, why might it be happening, what evidence do we have, what could happen next, what can I realistically do, and did that action actually help?”**

Build the software around answering that question reliably.
