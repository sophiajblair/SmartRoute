# Product Backlog (MoSCoW)

Priority is for a demonstrable local MVP; proposed operational scoring assumptions require stakeholder validation.

## Must have — MVP

1. **Authentication and authorization:** hashed-password demo accounts; role-protected API; role-aware navigation.
2. **Approved digital notebook:** twelve seeded routes, route and building information, searchable stored instructions, issue reporting.
3. **Knowledge governance:** pending suggestions; manager approve/reject; accepted values and version history.
4. **Replacement demand:** unit manager request form; director request list and review/reject decisions.
5. **Human-led allocation:** editable normalized score weights, live recommendation ranking, availability checks, uncovered work, override reason and database-backed approval.
6. **Delivery loop:** expert assignment state, validated parcel report, failure reasons and notifications.
7. **Operational view:** database-backed KPIs, route completion, request trends/status, failures and notebook completeness.
8. **Analytics filters:** date range, postal unit, route and employee.
9. **Local demo kit:** SQLite seed, macOS setup guide, fictional data and backend workflow tests.

## Should have

- Full building-entry edit workflow through pending manager approval (current MVP manager building writes are direct).
- Allocation weight persistence and configurable per-unit policies.
- Improved issue-to-notebook resolution workflow, request details and partial allocation quantities.
- Explicit notification deep-link behavior and notification preferences.
- Alembic migrations and database export/backup support.

## Could have

- Installable offline-first mobile experience and background synchronization.
- Map-backed route visualization using an approved self-hosted map source.
- CSV/print exports and operations reports.
- Additional natural-language query support over notebook records with source citations (no fabricated answers).

## Won't have in this university prototype

- Autonomous allocation, hidden scoring or unreviewed route instructions.
- Real employee/customer information, real parcel tracking or real door/access codes.
- Production identity/dispatch integrations, GPS tracking, paid APIs, SMS or email.
- Claims that the demonstration scoring policy represents La Poste's official policy.
