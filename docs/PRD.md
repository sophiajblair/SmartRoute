# Product Requirements Document — SmartRoute

## Product vision

Give postal delivery teams one trusted, continuously improved source of route knowledge and a transparent way to coordinate replacement cover—so every replacement has the right information, every unit can surface its need, and directors retain accountable control of allocations.

## Business problem

Replacement demand is higher than expert availability. Allocation currently relies on a locally maintained spreadsheet and informal judgement. Regular postmen's tacit route knowledge is fragmented in handwritten notes, while replacements may work unfamiliar rounds without a clear support channel. Managers have limited visibility into coverage and delivery outcomes.

## Target users

- **Area director:** prioritizes requests, sees cross-unit operations, manages expert availability and makes final allocation decisions.
- **Local unit manager:** requests cover, maintains local route knowledge, reviews postman updates/issues and monitors local outcomes.
- **Regular postman:** contributes accurate local route details and condition updates.
- **Expert replacement:** consumes approved notebook information, reports difficulties and closes the delivery feedback loop.

## Product objectives

1. Make approved route instructions searchable and accessible to authorized staff.
2. Convert tacit knowledge into reviewed, versioned notebook entries.
3. Provide explainable replacement priority recommendations without automating the director's decision.
4. Record assignment, delivery completion and failure outcomes.
5. Give managers and directors a current view of operational records.

## Functional requirements

- Authenticate users and enforce role permissions in the API.
- Create/search route notebooks and building information; report route issues.
- Keep postman-proposed route updates pending until unit-manager approval; preserve a history.
- Create unit-specific replacement requests; allow directors to review, reject and allocate.
- Score/rank requests using normalized urgency, backlog, workload and difficulty inputs.
- Check availability and prevent conflicting worker/date allocations. Require a reason for overrides.
- Notify relevant users of requests, decisions, allocations and reported issues.
- Let experts update assignment status and submit count-validated delivery reports.
- Calculate operational analytics from persisted records, with empty values where records are insufficient.

## Non-functional requirements

- Local macOS development using React, TypeScript, Vite, Tailwind, Lucide, Recharts, React Router, FastAPI, Pydantic, SQLAlchemy and SQLite.
- Role checks and input validation on the backend, hashed passwords, signed expiring authentication tokens and basic audit records.
- Responsive desktop/tablet/mobile presentation and no paid/cloud API dependency.
- Fictional seed data only; no building access codes.

## Success metrics for a future pilot

Metrics require an approved operational pilot and a defined baseline before targets can be validated:

- Share of active routes with manager-approved notebook records.
- Share of expert assignments to routes with complete approved notebooks.
- Request-to-decision time and requested-round coverage rate.
- Parcel delivery completion and return/postponement rate.
- Notebook update review time and rate of reported inaccurate instructions.
- Replacement satisfaction and manager adoption.

The prototype reports database-backed demonstration metrics; it does not claim that these figures represent La Poste operations.

## MVP scope

Included: role-based demo login, notebook search and approval workflow, requests, explainable recommendations and director approval, assignment lifecycle, delivery reports, notifications, dashboards, seeded local data and workflow tests.

Not included: production identity provider, dispatch integrations, live route/GPS services, SMS/email, production-grade access policies, data retention and backup controls, mobile offline mode, robust multi-tenant deployment, externally validated allocation policy or complete CRUD/version approval for every building field.

## Future development

Validate the prioritization policy with operational stakeholders; introduce SSO, security/privacy review, managed database and retention controls; add route/parcel integrations; support offline-first mobile workflows; strengthen building-entry changes with the same approval workflow; add date/unit/route/employee filters, notifications preferences and service-level monitoring.
