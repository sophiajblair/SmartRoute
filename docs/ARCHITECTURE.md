# Architecture

## System overview

```text
React + TypeScript + Vite
  React Router pages · Recharts · Lucide · responsive Tailwind styles
               │ HTTP/JSON + bearer JWT
               ▼
FastAPI REST API
  route handlers → Pydantic validation → authorization/services
               │ SQLAlchemy ORM
               ▼
SQLite (backend/smart_route.db)
```

The browser is a presentation client only; all business records, permission checks, validation, allocation ranking, workflow state and dashboard calculations are handled by the API/database. No cloud API or LLM key is required.

## Backend

- `backend/app/main.py`: FastAPI application, CORS allowlist, schema initialization and startup seed.
- `backend/app/api/routes.py`: REST endpoints, role checks and workflow orchestration.
- `backend/app/models.py`: relational entities, foreign keys, indexes and key check constraints.
- `backend/app/schemas.py`: Pydantic input validation for requests, notebook changes, issues, allocation and delivery reports.
- `backend/app/security.py`: PBKDF2-HMAC-SHA256 password hashing, signed expiring HS256-shaped JWT bearer tokens and reusable authorization dependencies.
- `backend/app/services/scoring.py`: normalizes pending request factors, applies configurable weights, ranks requests and returns an available expert recommendation.
- `backend/app/seed.py`: fictional idempotent demo seed.

The application creates tables on startup with SQLAlchemy metadata. Alembic is not configured in this MVP; schema evolution should use migrations before production use.

## Data model

`User` belongs optionally to a `PostalUnit`; `DeliveryRoute` belongs to a unit and a regular postman; each route has `BuildingInstruction`, `RouteIssue`, `NotebookChangeRequest` and `NotebookVersion` records. A `ReplacementRequest` belongs to its requesting user and unit. `ExpertAvailability` configures expert eligibility. A director-created `Allocation` connects a request, expert and route. An optional one-to-one `DeliveryReport` has one or more `DeliveryFailureReason` rows. `Notification` belongs to a recipient. `AuditLog` records important mutations.

All seeded personal/contact records are invented. The sample building instructions explicitly avoid access codes.

## API conventions

- API prefix: `/api`; JSON; bearer token in `Authorization`.
- Login: `POST /api/auth/login`; current identity: `GET /api/auth/me`.
- `401` means missing/invalid/expired session; `403` means authenticated but role/ownership is insufficient; `404` for inaccessible/not-found records; `409` for workflow conflicts; `422` for invalid input.
- Important endpoint groups: `/routes`, `/notebook-changes`, `/issues`, `/requests`, `/allocation`, `/availability`, `/assignments`, `/delivery-reports`, `/notifications`, `/analytics`. Analytics supports `start_date`, `end_date`, `unit_id`, `route_id` and `employee_id`.
- Interactive OpenAPI docs: `/docs`.

## Workflow/data flow

1. Manager creates a unit-scoped request → row and director notification are committed.
2. Director requests recommendations → service reads requests and expert availability, normalizes four factors and returns score/reasoning.
3. Director submits explicit approval → API checks active status, expert eligibility, route/unit match, date conflict and override reason → allocation and notifications are committed.
4. Expert reads own assignments and authorized notebook → issue/report actions are persisted.
5. Postman submits proposed approved-route field → pending row only. Unit manager approves/rejects → only approval mutates the canonical route, with a history row.
6. Analytics queries requests, reports, reasons and routes from SQLite and returns null/empty values where there is no evidence.

## Frontend

`frontend/src/App.tsx` contains route-aware workspace layout and workflow pages; `api.ts` adds the session token and surfaces API failures; `types.ts` defines key frontend contracts; `styles.css` provides responsive visual design. Sensitive decisions are not authorized solely by the rendered navigation—API authorization remains authoritative.

## Local configuration and limitations

`SMARTROUTE_DATABASE_URL` and `SMARTROUTE_SECRET_KEY` are read by the backend. The default database is a SQLite file next to the backend package. CORS is restricted to local Vite URLs. This is a single-process development setup, not a production deployment architecture; use a production secret manager, hardened token/session strategy, reviewed retention policy, proper migrations, deployment hardening and security review before any real-world use.
