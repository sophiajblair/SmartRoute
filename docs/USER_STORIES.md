# User stories and acceptance criteria

## Epic 1 — Digital Route Knowledge Management

### Find round instructions
As an expert replacement, I want to open my assigned route notebook and search its approved information, so that I can deliver on an unfamiliar round without relying on informal notes.

- **Given** a route is assigned to me, **when** I open its notebook, **then** I can view approved route information, building entries, known issues and support contacts.
- **When** I search an address or instruction, **then** matching stored records are returned; **if** none match, the notebook clearly says no information is recorded.
- **When** I request another user's unassigned route, **then** the API denies access.

### Share tacit route knowledge
As a regular postman, I want to propose a route-instruction change, so that my local knowledge can help future replacements.

- **When** I submit a permitted route field, **then** the request is stored as Pending Approval.
- **While** pending or rejected, the approved route value is unchanged.
- **When** my unit manager approves, **then** the approved route field changes and an approved version-history record identifies the reviewer and timestamp.
- **When** a manager rejects, **then** the official route value remains unchanged.

### Maintain local building details
As a local unit manager, I want to add, edit and remove building instructions in my unit, so that replacements have structured and current access guidance.

- **When** a manager saves a building, **then** it is persisted and reflected on the route page.
- **When** a manager in another unit tries to mutate it, **then** the API denies the request.
- **Then** demonstration data and UI warnings never request actual entry codes.

### Raise a route difficulty
As an expert replacement, I want to report a delivery obstacle, so that my manager can address it and the shared notebook can improve.

- **When** I report a valid issue on my assigned route, **then** it is stored with reporter, category, priority, status and timestamp.
- **Then** the unit manager receives a persisted in-app notification.

## Epic 2 — Intelligent Replacement Allocation

### Request replacement cover
As a local unit manager, I want to submit demand and workload details, so that the director can see where cover is needed.

- **When** required non-negative workload values and a 1–5 difficulty are submitted, **then** the request is stored as Pending for my own unit.
- **When** I view requests, **then** I see my own unit's records only.
- **Then** the director receives a persisted notification.

### Prioritize requests
As an area director, I want to see a transparent, adjustable priority score, so that I can make consistent decisions while retaining final responsibility.

- **When** I generate recommendations, **then** pending requests are ranked using normalized urgency, backlog, workload and difficulty.
- **Then** the response explains the normalized components and configured weights.
- **When** no suitable expert is available, **then** the result marks the request uncovered and does not invent an assignment.
- **Then** a manager cannot access the recommendation endpoint.

### Approve an allocation
As an area director, I want to approve a recommendation or record an override, so that deployment remains human-controlled and auditable.

- **When** I approve a valid available expert, **then** an allocation is stored and the request status changes.
- **When** the selected expert differs from the recommendation, **then** a meaningful reason is required.
- **When** that worker already has an active assignment on the same date, **then** the API returns a conflict and creates no allocation.
- **Then** manager and expert notifications are saved.

## Epic 3 — Delivery Performance and Feedback

### Complete an assignment
As an expert replacement, I want to start and complete my assigned delivery, so that operations can track assignment status.

- **When** I start the delivery, **then** its status becomes In Progress.
- **When** I submit a report, **then** it is saved against my assignment and the status becomes Completed or Partially Completed.
- **When** another user tries to update my assignment, **then** the API denies access.

### Record delivery outcomes
As an expert replacement, I want to report parcel totals and failure reasons, so that the unit can understand postponed work.

- **Then** assigned parcels equal delivered plus undelivered.
- **Then** failure-reason counts equal the undelivered total.
- **When** either constraint fails, **then** the API rejects the report and no successful report is persisted.
- **Then** a report cannot be submitted twice for the same assignment.

### Monitor operations
As a manager or area director, I want charts derived from records, so that I can identify coverage and route-quality patterns.

- **When** saved records change, **then** refreshed analytics recalculate from the database.
- **When** a measure has no source records, **then** the UI shows an empty value/state instead of a fabricated figure.
- **Then** demo analytics are visibly labelled fictional.
