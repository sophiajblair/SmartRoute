# SmartRoute

**The right information. The right replacement. The right delivery.**

SmartRoute is a local-first university prototype for postal route knowledge, replacement requests, human-reviewed allocation recommendations, delivery reporting, notifications and operational analytics.

> **Prototype warning:** SmartRoute is not approved for production use at La Poste. All seeded people, addresses, contact details and performance records are fictional. Never store real entry codes, customer data or sensitive employee information.

## What is implemented

- FastAPI REST backend, SQLAlchemy relational models, SQLite persistence, Pydantic request validation and role-protected endpoints.
- Password hashing (PBKDF2-HMAC-SHA256), signed expiring bearer tokens, four demo roles and audit events.
- Seeded demonstration environment: one director, three unit managers, six postmen, ten experts, three fictional units and twelve routes.
- Route notebook cards and details, structured building instructions, database-backed notebook search, issue reporting, pending-change approval/rejection and approved version history.
- Replacement request submission, filtering, director review/rejection, availability management and explainable configurable priority recommendations.
- Director-controlled assignment approval, conflict checks, override-reason enforcement and in-app notifications to the unit manager and assigned expert.
- Expert assignment lifecycle, delivery reports with backend-enforced parcel and failure-count validation, and operational analytics from stored records.
- Analytics filters by date range, postal unit, route and employee.
- Responsive React/TypeScript dashboard, React Router navigation, Recharts charts, Tailwind setup, Lucide icons, search, toast messages and responsive layouts.

## Prerequisites (macOS)

- Python 3.11 or newer
- Node.js 20 or newer (includes npm)

Install Node.js with Homebrew if needed:

```bash
brew install node
```

Or install the current LTS release from [nodejs.org](https://nodejs.org/). Check both runtimes:

```bash
python3 --version
node --version
npm --version
```

## Start the backend

From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --env-file .env
```

The API is at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`. On first startup, tables are created and fictional demonstration records are seeded into `backend/smart_route.db`. The seed runs only if the users table is empty. The database survives restarts.

For any shared environment, set a private random `SMARTROUTE_SECRET_KEY` in the backend process environment. The bundled local fallback key is only for local demonstration.

## Start the frontend

In a second terminal, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies no API calls: the frontend calls the local API at `http://127.0.0.1:8000/api`. Keep both terminal processes running.

## Demo credentials

All accounts use the password **`SmartRoute2026!`**.

| Role | Email |
|---|---|
| Area director | `director@smartroute.demo` |
| Unit manager (Paris) | `manager1@smartroute.demo` |
| Unit manager (Lyon) | `manager2@smartroute.demo` |
| Unit manager (Bordeaux) | `manager3@smartroute.demo` |
| Regular postman | `postman1@smartroute.demo` through `postman6@smartroute.demo` |
| Expert replacement | `expert1@smartroute.demo` through `expert10@smartroute.demo` |

## Suggested end-to-end demo

1. Sign in as `manager1@smartroute.demo`, create a replacement request, then open a route notebook and propose an update or report an issue.
2. Sign in as `director@smartroute.demo`; review requests and generate recommendations. Review the score breakdown and choose the recommended expert, or enter an override reason.
3. Sign in as the allocated expert; open **My assignments**, open the route notebook, search a building/address/instruction, report a route difficulty, start the round and submit a delivery report.
4. Sign in as the unit manager; review the reported issue and approve/reject the postman's pending notebook update.
5. Return to the area director's **Analytics** page to see updated data-backed outcomes.

The first expert account also has seeded historical assignments for immediate exploration.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

The suite exercises authentication, role boundaries, request creation, allocation recommendation/approval, double-booking protection, notebook approval/versioning, delivery validation, analytics, notifications, no-expert allocation and notebook search.

## Project map

```text
backend/app/             FastAPI app, SQLAlchemy models, API, validation and services
backend/tests/            API integration tests
frontend/src/             React/TypeScript application and styles
docs/                     Product and engineering documentation
```

See [docs/TESTING.md](./docs/TESTING.md) for workflow test details and known MVP boundaries.
