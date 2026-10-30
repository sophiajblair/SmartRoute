# Testing and demonstration

## Automated backend tests

Run:

```bash
cd backend
source .venv/bin/activate
pytest -q
```

The pytest client starts the FastAPI application against a temporary local test SQLite database and exercises:

- Correct/incorrect authentication and returned role.
- Unit-scoped route list and denial of manager access to director allocation.
- Replacement request creation, persisted status and director visibility.
- Live priority recommendation and explicit director allocation.
- Same-expert/date conflict rejection (when the seeded date and active assignments permit the test allocation).
- Pending notebook suggestion, unchanged canonical content, approval, and version history.
- Invalid parcel totals and mismatch between failure counts and undelivered parcels.
- Expert assignment transition and a valid persisted delivery report.
- Record-backed dashboard KPIs, notification read state and no-expert recommendations.
- Date-range, unit, route and employee filters on analytics queries.
- Route notebook search and explicit no-information response.

The tests do not constitute a full security assessment or production readiness certification.

## Manual end-to-end demo

1. Start the API and frontend using the root README instructions.
2. Log in as `manager1@smartroute.demo`; submit a new replacement request.
3. Log in as `director@smartroute.demo`; review the new request and open Smart Allocation.
4. Generate live recommendations. Compare normalized factor explanations; approve the suggested worker or select another worker and supply an override reason.
5. Log in as the allocated expert; open My Assignments and the linked route notebook; search `entrance` or a stored street.
6. Report a route difficulty; start delivery; submit parcel totals and a failure reason.
7. Log in as the manager; review the issue and approve/reject pending notebook updates on a route.
8. Refresh Analytics; completion and postponement figures recalculate from the persisted report.

## Important limitations to disclose

- All seeded operational data is fictional; one test/demo database is shared by the application.
- Initial schema creation uses `create_all`, not an Alembic migration history.
- Example scoring weights are proposals and are not operational policy.
- Request coverage status currently represents whether at least one expert was assigned; the UI labels remaining uncovered rounds but does not support multi-expert partial quantities.
- Frontend TypeScript and production Vite build are verified with Node 20/npm; the browser smoke test covered dashboard, notebook navigation and stored-instruction search.
- Production SSO, full session lifecycle/refresh, all building edits through the approval workflow, detailed audit review UI and sophisticated allocation fairness are outside the current MVP.
