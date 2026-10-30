# Product Epics

## Epic 1: Digital Route Knowledge Management

**Outcome:** authorized staff can find current route and building instructions and safely contribute reviewed updates.

- Search route notebooks, route instructions, building details and reported issues.
- Submit proposed route text as pending knowledge, without mutating approved notebook content.
- Let the local manager approve or reject a proposal; preserve approved values and update history.
- Report issues from an assigned expert workflow and make them visible to the unit manager.
- Manage basic building instructions with a unit-manager-only API.

## Epic 2: Intelligent Replacement Allocation

**Outcome:** directors can compare requests using transparent prioritization and record a human-approved assignment.

- Capture replacement demand by unit and requested date.
- Normalize urgency, backlog, workload and route difficulty and show each weighted component.
- Edit proposed weights and rank live pending requests.
- Respect availability and date conflicts; identify uncovered recommendations.
- Require a reason when the final expert differs from the recommendation; persist the decision and notify users.

The demonstration weights (30/30/25/15) are proposed assumptions, not validated La Poste rules.

## Epic 3: Delivery Performance and Feedback

**Outcome:** replacement outcomes and route difficulties feed unit operations and dashboard measures.

- Give each expert a private assignment list with route notebook access.
- Track assigned, in-progress, completed and partially completed assignment states.
- Require assigned = delivered + undelivered and failure counts = undelivered.
- Show delivery outcomes, failure reasons, request statuses and notebook completeness from database records.
- Persist user notifications and read status.
