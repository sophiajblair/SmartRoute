from datetime import date
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Allocation, AuditLog, BuildingInstruction, DeliveryFailureReason, DeliveryReport, DeliveryRoute,
    ExpertAvailability, Notification, NotebookChangeRequest, NotebookVersion, PostalUnit,
    ReplacementRequest, RouteIssue, User,
)
from ..schemas import (
    AllocationInput, BuildingInput, BuildingUpdateInput, DeliveryInput, IssueInput, LoginInput,
    NotebookChangeInput, RecommendationsInput, RequestInput, RouteCreateInput,
)
from ..security import create_token, current_user, hash_password, require_roles, verify_password
from ..services.scoring import DEFAULT_WEIGHTS, rank_requests


router = APIRouter(prefix="/api")
DIRECTOR = ("director",)
MANAGERS = ("director", "manager")


def user_view(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "unit_id": user.unit_id}


def audit(db, user, action, entity, entity_id, details=""):
    db.add(AuditLog(user_id=user.id, action=action, entity_type=entity, entity_id=entity_id, details=details))


def visible_route(db, user, route_id):
    route = db.get(DeliveryRoute, route_id)
    if not route:
        raise HTTPException(404, "Route not found")
    if user.role == "manager" and route.unit_id != user.unit_id:
        raise HTTPException(403, "Route belongs to another unit")
    if user.role == "postman" and route.postman_id != user.id:
        raise HTTPException(403, "Route is not assigned to you")
    if user.role == "expert":
        assigned = db.query(Allocation).filter(Allocation.expert_id == user.id, Allocation.route_id == route.id).first()
        if not assigned:
            raise HTTPException(403, "Route is not assigned to you")
    return route


@router.post("/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == data.email.lower()).first()
    if not user or not user.active or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_token(user), "token_type": "bearer", "user": user_view(user)}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return user_view(user)


@router.get("/units")
def units(db: Session = Depends(get_db), user: User = Depends(current_user)):
    query = db.query(PostalUnit)
    if user.role in ("manager", "postman") and user.unit_id:
        query = query.filter(PostalUnit.id == user.unit_id)
    return [{"id": u.id, "name": u.name, "city": u.city} for u in query.order_by(PostalUnit.name)]


@router.get("/routes")
def routes(search: str = "", db: Session = Depends(get_db), user: User = Depends(current_user)):
    query = db.query(DeliveryRoute)
    if user.role == "manager" and user.unit_id:
        query = query.filter(DeliveryRoute.unit_id == user.unit_id)
    if user.role == "postman":
        query = query.filter(DeliveryRoute.postman_id == user.id)
    if user.role == "expert":
        assigned = db.query(Allocation.route_id).filter(Allocation.expert_id == user.id)
        query = query.filter(DeliveryRoute.id.in_(assigned))
    if search:
        term = f"%{search}%"
        query = query.filter((DeliveryRoute.name.ilike(term)) | (DeliveryRoute.code.ilike(term)))
    records = query.order_by(DeliveryRoute.code).all()
    return [{
        "id": r.id, "code": r.code, "name": r.name, "unit_id": r.unit_id,
        "unit": db.get(PostalUnit, r.unit_id).name, "postman": db.get(User, r.postman_id).name if r.postman_id else "Unassigned",
        "duration_minutes": r.duration_minutes, "parcel_volume": r.parcel_volume, "difficulty": r.difficulty,
        "updated_at": r.updated_at.isoformat(), "description": r.description, "sequence": r.sequence,
        "obstacles": r.obstacles, "instructions": r.instructions,
        "buildings_count": db.query(BuildingInstruction).filter_by(route_id=r.id).count(),
        "issues_count": db.query(RouteIssue).filter_by(route_id=r.id, status="Open").count(),
        "completeness": min(100, sum(bool(getattr(r, field)) for field in ("description", "sequence", "obstacles", "instructions")) * 20
                           + min(20, db.query(BuildingInstruction).filter_by(route_id=r.id).count() * 10)),
    } for r in records]


@router.post("/routes")
def create_route(data: RouteCreateInput, db: Session = Depends(get_db), user: User = Depends(require_roles("manager"))):
    if db.query(DeliveryRoute).filter_by(code=data.code).first():
        raise HTTPException(409, "A route with this ID already exists")
    route = DeliveryRoute(unit_id=user.unit_id, **data.model_dump())
    db.add(route)
    db.flush()
    audit(db, user, "create_route_notebook", "DeliveryRoute", route.id, route.code)
    db.commit()
    return {"id": route.id, "code": route.code}


@router.get("/routes/{route_id}")
def route_detail(route_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    route = visible_route(db, user, route_id)
    buildings = db.query(BuildingInstruction).filter_by(route_id=route.id).all()
    issues = db.query(RouteIssue).filter_by(route_id=route.id).order_by(RouteIssue.created_at.desc()).all()
    versions = db.query(NotebookVersion).filter_by(route_id=route.id).order_by(NotebookVersion.created_at.desc()).all()
    history = []
    for version in versions:
        if version.field in ("description", "sequence", "obstacles", "instructions"):
            continue
        contributor = db.get(User, version.changed_by)
        history.append({
            "field": version.field, "submitted_by": contributor.name, "reviewed_by": contributor.name,
            "new_value": version.new_value, "approval_status": version.approval_status,
            "created_at": version.created_at.isoformat(),
        })
    reviewed_changes = db.query(NotebookChangeRequest).filter(
        NotebookChangeRequest.route_id == route.id,
        NotebookChangeRequest.status.in_(["Approved", "Rejected"]),
    ).all()
    for change in reviewed_changes:
        audit_event = db.query(AuditLog).filter(
            AuditLog.entity_type == "NotebookChangeRequest",
            AuditLog.entity_id == change.id,
            AuditLog.action.in_(["notebook_change_approve", "notebook_change_reject"]),
        ).order_by(AuditLog.created_at.desc()).first()
        history.append({
            "field": change.field, "submitted_by": db.get(User, change.submitted_by).name,
            "reviewed_by": db.get(User, audit_event.user_id).name if audit_event and audit_event.user_id else "Unknown reviewer",
            "new_value": change.value, "approval_status": change.status,
            "created_at": (change.reviewed_at or change.created_at).isoformat(),
        })
    history.sort(key=lambda item: item["created_at"], reverse=True)
    pending = db.query(NotebookChangeRequest).filter_by(route_id=route.id, status="Pending Approval").all()
    return {
        "route": next(x for x in routes("", db, user) if x["id"] == route.id),
        "manager_contact": route.manager_contact, "support_contact": route.support_contact,
        "buildings": [vars_without_state(x) for x in buildings],
        "issues": [{"id": i.id, "title": i.title, "description": i.description, "category": i.category,
                    "priority": i.priority, "status": i.status, "resolution": i.resolution,
                    "reported_by": db.get(User, i.reported_by).name, "created_at": i.created_at.isoformat()} for i in issues],
        "history": history[:30],
        "pending_changes": [{"id": c.id, "field": c.field, "value": c.value, "submitted_by": db.get(User, c.submitted_by).name,
                             "created_at": c.created_at.isoformat()} for c in pending] if user.role in ("manager", "director") else [],
    }


def vars_without_state(record):
    return {key: value for key, value in record.__dict__.items() if not key.startswith("_")}


@router.get("/routes/{route_id}/search")
def notebook_search(route_id: int, q: str = Query(min_length=1), db: Session = Depends(get_db), user: User = Depends(current_user)):
    visible_route(db, user, route_id)
    term = q.strip().lower()
    if not term:
        raise HTTPException(422, "Search query cannot be blank")
    route = db.get(DeliveryRoute, route_id)
    found = []
    for field in ("description", "sequence", "obstacles", "instructions"):
        value = getattr(route, field)
        if term in value.lower():
            found.append({"type": "Route information", "title": field.replace("_", " ").title(), "content": value})
    for building in db.query(BuildingInstruction).filter_by(route_id=route_id):
        values = [building.name, building.address, building.entrance, building.access_instructions,
                  building.delivery_instructions, building.difficulties, building.notes]
        content = " · ".join(value for value in values if value)
        if term in content.lower():
            found.append({"type": "Building", "title": building.name, "content": content})
    for issue in db.query(RouteIssue).filter_by(route_id=route_id):
        if term in f"{issue.title} {issue.description} {issue.category}".lower():
            found.append({"type": "Known issue", "title": issue.title, "content": issue.description})
    return {"query": q, "results": found, "message": None if found else "No matching information is recorded in this notebook."}


@router.post("/notebook-changes")
def submit_notebook_change(data: NotebookChangeInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    route = visible_route(db, user, data.route_id)
    if user.role not in ("postman", "manager"):
        raise HTTPException(403, "Only postmen and unit managers can submit notebook changes")
    change = NotebookChangeRequest(route_id=route.id, submitted_by=user.id, field=data.field, value=data.value)
    db.add(change)
    db.flush()
    for manager in db.query(User).filter(User.role == "manager", User.unit_id == route.unit_id):
        db.add(Notification(user_id=manager.id, message=f"Route notebook update needs approval: {route.code}.",
                            link=f"/notebooks/{route.id}"))
    audit(db, user, "submit_notebook_change", "NotebookChangeRequest", change.id, data.field)
    db.commit()
    db.refresh(change)
    return {"id": change.id, "status": change.status}


@router.post("/notebook-changes/{change_id}/review")
def review_notebook_change(change_id: int, decision: str, note: str = "", db: Session = Depends(get_db),
                           user: User = Depends(require_roles(*MANAGERS))):
    change = db.get(NotebookChangeRequest, change_id)
    if not change:
        raise HTTPException(404, "Notebook change not found")
    route = db.get(DeliveryRoute, change.route_id)
    if user.role == "manager" and route.unit_id != user.unit_id:
        raise HTTPException(403, "This change belongs to another unit")
    if change.status != "Pending Approval" or decision not in ("approve", "reject"):
        raise HTTPException(409, "Change is not pending or decision is invalid")
    change.status = "Approved" if decision == "approve" else "Rejected"
    change.review_note = note
    change.reviewed_at = datetime.now(timezone.utc)
    if decision == "approve":
        old = getattr(route, change.field)
        setattr(route, change.field, change.value)
        route.updated_at = change.reviewed_at
        db.add(NotebookVersion(route_id=route.id, changed_by=user.id, field=change.field,
                               old_value=old, new_value=change.value, approval_status="Approved"))
    db.add(Notification(user_id=change.submitted_by,
                        message=f"Your route notebook update was {change.status.lower()}.",
                        link=f"/notebooks/{route.id}"))
    audit(db, user, f"notebook_change_{decision}", "NotebookChangeRequest", change.id, note)
    db.commit()
    return {"id": change.id, "status": change.status}


@router.post("/issues")
def report_issue(data: IssueInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    visible_route(db, user, data.route_id)
    issue = RouteIssue(**data.model_dump(), reported_by=user.id)
    db.add(issue)
    db.flush()
    for manager in db.query(User).filter(User.role == "manager", User.unit_id == db.get(DeliveryRoute, data.route_id).unit_id):
        db.add(Notification(user_id=manager.id, message=f"Route issue reported: {issue.title}", link=f"/notebooks/{data.route_id}"))
    audit(db, user, "report_route_issue", "RouteIssue", issue.id, issue.title)
    db.commit()
    return {"id": issue.id, "status": issue.status}


@router.patch("/issues/{issue_id}")
def update_issue(issue_id: int, status: str, resolution: str = "", db: Session = Depends(get_db),
                 user: User = Depends(require_roles(*MANAGERS))):
    issue = db.get(RouteIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Issue not found")
    route = db.get(DeliveryRoute, issue.route_id)
    if user.role == "manager" and route.unit_id != user.unit_id:
        raise HTTPException(403, "Issue belongs to another unit")
    if status not in ("Open", "In Progress", "Resolved", "Needs Review"):
        raise HTTPException(422, "Invalid issue status")
    issue.status, issue.resolution = status, resolution
    audit(db, user, "update_route_issue", "RouteIssue", issue.id, status)
    db.commit()
    return {"id": issue.id, "status": issue.status}


@router.post("/requests")
def create_request(data: RequestInput, db: Session = Depends(get_db), user: User = Depends(require_roles("manager"))):
    request = ReplacementRequest(**data.model_dump(), unit_id=user.unit_id, requested_by=user.id)
    db.add(request)
    db.flush()
    for director in db.query(User).filter_by(role="director"):
        db.add(Notification(user_id=director.id, message=f"New replacement request from {db.get(PostalUnit, user.unit_id).name}.", link="/requests"))
    audit(db, user, "create_replacement_request", "ReplacementRequest", request.id)
    db.commit()
    db.refresh(request)
    return {"id": request.id, "status": request.status}


@router.get("/requests")
def list_requests(db: Session = Depends(get_db), user: User = Depends(require_roles("director", "manager"))):
    query = db.query(ReplacementRequest)
    if user.role == "manager":
        query = query.filter(ReplacementRequest.unit_id == user.unit_id)
    records = query.order_by(ReplacementRequest.request_date.desc()).all()
    scores = {
        row["request_id"]: row for row in rank_requests(db)
    }
    return [{
        "id": r.id, "unit_id": r.unit_id, "unit": db.get(PostalUnit, r.unit_id).name,
        "request_date": r.request_date.isoformat(), "absent_employees": r.absent_employees,
        "uncovered_rounds": r.uncovered_rounds, "parcel_volume": r.parcel_volume, "backlog": r.backlog,
        "urgent_deliveries": r.urgent_deliveries, "route_difficulty": r.route_difficulty,
        "comments": r.comments, "status": r.status,
        "priority_score": scores.get(r.id, {}).get("priority_score"),
        "priority": scores.get(r.id, {}).get("priority"),
    } for r in records]


@router.patch("/requests/{request_id}")
def review_request(request_id: int, status: str, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(*DIRECTOR))):
    request = db.get(ReplacementRequest, request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    if status not in ("Under Review", "Rejected"):
        raise HTTPException(422, "Director may move a request to Under Review or Rejected")
    if request.status not in ("Pending", "Under Review"):
        raise HTTPException(409, "Request has already been decided")
    request.status = status
    db.add(Notification(user_id=request.requested_by,
                        message=f"Your replacement request is now {status.lower()}.", link="/requests"))
    audit(db, user, "review_replacement_request", "ReplacementRequest", request.id, status)
    db.commit()
    return {"id": request.id, "status": request.status}


@router.post("/allocation/recommendations")
def recommendations(data: RecommendationsInput | None = None, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(*DIRECTOR))):
    weights = data.weights.model_dump() if data and data.weights else None
    try:
        return {"weights": weights or DEFAULT_WEIGHTS, "recommendations": rank_requests(db, weights=weights)}
    except (KeyError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/allocation/approve")
def approve_allocation(data: AllocationInput, db: Session = Depends(get_db), user: User = Depends(require_roles(*DIRECTOR))):
    request = db.get(ReplacementRequest, data.request_id)
    expert = db.get(User, data.expert_id)
    availability = db.query(ExpertAvailability).filter_by(user_id=data.expert_id).first()
    if not request or not expert or expert.role != "expert" or not availability or not availability.available:
        raise HTTPException(422, "Request or available expert is invalid")
    if not data.route_id:
        candidate = db.query(DeliveryRoute).filter_by(unit_id=request.unit_id).order_by(DeliveryRoute.id).first()
        if not candidate:
            raise HTTPException(422, "No delivery route exists for this unit")
        data.route_id = candidate.id
    route = db.get(DeliveryRoute, data.route_id)
    if not route or route.unit_id != request.unit_id:
        raise HTTPException(422, "Selected route must belong to the requested postal unit")
    if request.status not in ("Pending", "Under Review"):
        raise HTTPException(409, "Request is no longer awaiting allocation")
    conflict = db.query(Allocation).filter(
        Allocation.expert_id == expert.id, Allocation.assignment_date == request.request_date,
        Allocation.status.in_(["Assigned", "In Progress"]),
    ).first()
    if conflict:
        raise HTTPException(409, "Expert already has a conflicting assignment on this date")
    if data.override_reason.strip() and len(data.override_reason.strip()) < 8:
        raise HTTPException(422, "Override reason must contain at least 8 characters")
    weights = data.weights.model_dump() if data.weights else None
    ranked = {item["request_id"]: item for item in rank_requests(db, weights=weights)}
    recommended = ranked.get(request.id)
    if not data.override_reason.strip() and (not recommended or recommended["expert_id"] != expert.id):
        raise HTTPException(409, "This is an override; provide a reason to continue")
    allocation = Allocation(
        request_id=request.id, expert_id=expert.id, route_id=route.id, assignment_date=request.request_date,
        status="Assigned", score=recommended["priority_score"] if recommended else 0,
        reasoning=recommended["reasoning"] if recommended else "Manual allocation.",
        override_reason=data.override_reason.strip(), allocated_by=user.id,
    )
    db.add(allocation)
    request.status = "Partially Covered" if request.uncovered_rounds > 1 else "Approved"
    db.add(Notification(user_id=request.requested_by,
                        message=f"Your replacement request has been {request.status.lower()}.",
                        link="/requests"))
    db.add(Notification(user_id=expert.id, message=f"You have been assigned to route {route.code}.", link="/assignments"))
    audit(db, user, "approve_allocation", "Allocation", request.id, data.override_reason)
    db.commit()
    db.refresh(allocation)
    return {"id": allocation.id, "status": allocation.status, "request_status": request.status}


@router.get("/availability")
def availability(db: Session = Depends(get_db), user: User = Depends(require_roles(*DIRECTOR))):
    records = db.query(ExpertAvailability).join(User).all()
    return [{"user_id": a.user_id, "name": db.get(User, a.user_id).name, "available": a.available,
             "skills": a.skills} for a in records]


@router.patch("/availability/{expert_id}")
def update_availability(expert_id: int, available: bool, db: Session = Depends(get_db),
                        user: User = Depends(require_roles(*DIRECTOR))):
    record = db.query(ExpertAvailability).filter_by(user_id=expert_id).first()
    if not record:
        raise HTTPException(404, "Expert availability not found")
    record.available = available
    audit(db, user, "update_expert_availability", "ExpertAvailability", record.id, str(available))
    db.commit()
    return {"expert_id": expert_id, "available": record.available}


@router.post("/buildings")
def create_building(data: BuildingInput, db: Session = Depends(get_db), user: User = Depends(require_roles("manager"))):
    route = visible_route(db, user, data.route_id)
    building = BuildingInstruction(**data.model_dump())
    db.add(building)
    route.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.add(NotebookVersion(route_id=route.id, changed_by=user.id, field="building", old_value="",
                           new_value=f"Added {building.name}", approval_status="Approved"))
    audit(db, user, "create_building_instruction", "BuildingInstruction", building.id)
    db.commit()
    return {"id": building.id}


@router.patch("/buildings/{building_id}")
def edit_building(building_id: int, data: BuildingUpdateInput, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(*MANAGERS))):
    building = db.get(BuildingInstruction, building_id)
    if not building:
        raise HTTPException(404, "Building instruction not found")
    route = visible_route(db, user, building.route_id)
    allowed = {"name", "address", "entrance", "access_instructions", "delivery_instructions", "difficulties", "notes"}
    updates = {key: value for key, value in data.model_dump(exclude_unset=True).items()
               if key in allowed and value is not None}
    if not updates:
        raise HTTPException(422, "Provide at least one editable building field")
    for key, value in updates.items():
        setattr(building, key, value)
    route.updated_at = datetime.now(timezone.utc)
    db.add(NotebookVersion(route_id=route.id, changed_by=user.id, field="building",
                           old_value="", new_value=f"Updated {building.name}", approval_status="Approved"))
    audit(db, user, "edit_building_instruction", "BuildingInstruction", building.id)
    db.commit()
    return {"id": building.id, "status": "updated"}


@router.delete("/buildings/{building_id}")
def delete_building(building_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGERS))):
    building = db.get(BuildingInstruction, building_id)
    if not building:
        raise HTTPException(404, "Building instruction not found")
    route = visible_route(db, user, building.route_id)
    name = building.name
    route.updated_at = datetime.now(timezone.utc)
    db.add(NotebookVersion(route_id=route.id, changed_by=user.id, field="building",
                           old_value=name, new_value=f"Deleted {name}", approval_status="Approved"))
    audit(db, user, "delete_building_instruction", "BuildingInstruction", building.id, name)
    db.delete(building)
    db.commit()
    return {"status": "deleted"}


@router.get("/assignments")
def assignments(db: Session = Depends(get_db), user: User = Depends(require_roles("director", "manager", "expert"))):
    query = db.query(Allocation)
    if user.role == "expert":
        query = query.filter(Allocation.expert_id == user.id)
    elif user.role == "manager":
        unit_route_ids = db.query(DeliveryRoute.id).filter_by(unit_id=user.unit_id)
        query = query.filter(Allocation.route_id.in_(unit_route_ids))
    records = query.order_by(Allocation.assignment_date.desc()).all()
    return [{
        "id": a.id, "request_id": a.request_id, "expert_id": a.expert_id,
        "expert": db.get(User, a.expert_id).name, "route_id": a.route_id,
        "route": db.get(DeliveryRoute, a.route_id).name if a.route_id else "Unassigned",
        "route_code": db.get(DeliveryRoute, a.route_id).code if a.route_id else "",
        "unit": db.get(PostalUnit, db.get(DeliveryRoute, a.route_id).unit_id).name if a.route_id else "",
        "duration_minutes": db.get(DeliveryRoute, a.route_id).duration_minutes if a.route_id else None,
        "parcel_volume": db.get(DeliveryRoute, a.route_id).parcel_volume if a.route_id else None,
        "difficulty": db.get(DeliveryRoute, a.route_id).difficulty if a.route_id else None,
        "manager_contact": db.get(DeliveryRoute, a.route_id).manager_contact if a.route_id else "",
        "date": a.assignment_date.isoformat(), "status": a.status, "score": a.score,
        "report_id": db.query(DeliveryReport.id).filter_by(allocation_id=a.id).scalar(),
    } for a in records]


@router.patch("/assignments/{allocation_id}")
def update_assignment(allocation_id: int, status: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    allocation = db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(404, "Assignment not found")
    if user.role != "expert" or allocation.expert_id != user.id:
        raise HTTPException(403, "Only the assigned expert can update this assignment")
    if status not in ("In Progress", "Completed", "Partially Completed"):
        raise HTTPException(422, "Invalid assignment status")
    if status in ("Completed", "Partially Completed"):
        raise HTTPException(409, "Submit a delivery report to complete this assignment")
    if allocation.status not in ("Assigned", "In Progress"):
        raise HTTPException(409, "Assignment is already complete")
    allocation.status = status
    audit(db, user, "update_assignment", "Allocation", allocation.id, status)
    db.commit()
    return {"id": allocation.id, "status": allocation.status}


@router.post("/delivery-reports")
def submit_report(data: DeliveryInput, db: Session = Depends(get_db), user: User = Depends(require_roles("expert"))):
    allocation = db.get(Allocation, data.allocation_id)
    if not allocation or allocation.expert_id != user.id:
        raise HTTPException(404, "Assignment not found")
    if allocation.status not in ("Assigned", "In Progress"):
        raise HTTPException(409, "Assignment is not available for a delivery report")
    if db.query(DeliveryReport).filter_by(allocation_id=allocation.id).first():
        raise HTTPException(409, "A delivery report already exists for this assignment")
    report = DeliveryReport(allocation_id=allocation.id, assigned=data.assigned, delivered=data.delivered,
                            undelivered=data.undelivered, comments=data.comments)
    db.add(report)
    db.flush()
    db.add_all([DeliveryFailureReason(report_id=report.id, reason=item.reason, parcel_count=item.parcel_count)
                for item in data.failures])
    allocation.status = "Completed" if not data.undelivered else "Partially Completed"
    audit(db, user, "submit_delivery_report", "DeliveryReport", report.id)
    db.commit()
    return {"id": report.id, "status": allocation.status}


@router.get("/delivery-reports")
def delivery_reports(db: Session = Depends(get_db), user: User = Depends(require_roles("director", "manager", "expert"))):
    query = db.query(DeliveryReport).join(Allocation)
    if user.role == "manager":
        route_ids = db.query(DeliveryRoute.id).filter_by(unit_id=user.unit_id)
        query = query.filter(Allocation.route_id.in_(route_ids))
    elif user.role == "expert":
        query = query.filter(Allocation.expert_id == user.id)
    reports = query.order_by(DeliveryReport.created_at.desc()).all()
    return [{"id": r.id, "allocation_id": r.allocation_id, "route": db.get(DeliveryRoute, db.get(Allocation, r.allocation_id).route_id).code,
             "assigned": r.assigned, "delivered": r.delivered, "undelivered": r.undelivered, "comments": r.comments,
             "failures": [{"reason": f.reason, "parcel_count": f.parcel_count}
                          for f in db.query(DeliveryFailureReason).filter_by(report_id=r.id)]} for r in reports]


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    records = db.query(Notification).filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(100).all()
    return [{"id": n.id, "message": n.message, "link": n.link, "read": n.read, "created_at": n.created_at.isoformat()} for n in records]


@router.patch("/notifications/{notification_id}/read")
def mark_notification(notification_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    notification = db.get(Notification, notification_id)
    if not notification or notification.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    notification.read = True
    db.commit()
    return {"id": notification.id, "read": notification.read}


@router.get("/analytics")
def analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    unit_id: int | None = None,
    route_id: int | None = None,
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("director", "manager")),
):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(422, "End date cannot be earlier than start date")
    request_query = db.query(ReplacementRequest)
    report_query = db.query(DeliveryReport).join(Allocation).join(DeliveryRoute)
    selected_unit = user.unit_id if user.role == "manager" else unit_id
    if user.role == "manager":
        report_query = report_query.filter(DeliveryRoute.unit_id == user.unit_id)
        request_query = request_query.filter(ReplacementRequest.unit_id == user.unit_id)
    elif selected_unit:
        request_query = request_query.filter(ReplacementRequest.unit_id == selected_unit)
        report_query = report_query.filter(DeliveryRoute.unit_id == selected_unit)
    if start_date:
        request_query = request_query.filter(ReplacementRequest.request_date >= start_date)
        report_query = report_query.filter(Allocation.assignment_date >= start_date)
    if end_date:
        request_query = request_query.filter(ReplacementRequest.request_date <= end_date)
        report_query = report_query.filter(Allocation.assignment_date <= end_date)
    if route_id:
        report_query = report_query.filter(DeliveryRoute.id == route_id)
        request_query = request_query.filter(ReplacementRequest.id.in_(
            db.query(Allocation.request_id).filter(Allocation.route_id == route_id)
        ))
    if employee_id:
        report_query = report_query.filter(Allocation.expert_id == employee_id)
        request_query = request_query.filter(ReplacementRequest.id.in_(
            db.query(Allocation.request_id).filter(Allocation.expert_id == employee_id)
        ))
    requests = request_query.all()
    reports = report_query.all()
    total_assigned = sum(report.assigned for report in reports)
    total_delivered = sum(report.delivered for report in reports)
    units = db.query(PostalUnit).all()
    by_unit = []
    for unit in units:
        if selected_unit and unit.id != selected_unit:
            continue
        unit_reports = [r for r in reports if db.get(DeliveryRoute, db.get(Allocation, r.allocation_id).route_id).unit_id == unit.id]
        assigned = sum(r.assigned for r in unit_reports)
        if assigned:
            by_unit.append({"unit": unit.name, "completion_rate": round(100 * sum(r.delivered for r in unit_reports) / assigned, 1)})
    reasons = {}
    for report in reports:
        for failure in db.query(DeliveryFailureReason).filter_by(report_id=report.id):
            reasons[failure.reason] = reasons.get(failure.reason, 0) + failure.parcel_count
    status_counts = {status: sum(r.status == status for r in requests) for status in ("Approved", "Partially Covered", "Rejected", "Pending", "Under Review")}
    route_query = db.query(DeliveryRoute)
    if selected_unit:
        route_query = route_query.filter(DeliveryRoute.unit_id == selected_unit)
    if route_id:
        route_query = route_query.filter(DeliveryRoute.id == route_id)
    routes_data = route_query.all()
    completeness = {}
    for unit in units:
        if selected_unit and unit.id != selected_unit:
            continue
        unit_routes = [r for r in routes_data if r.unit_id == unit.id]
        completeness[unit.name] = round(sum(
            min(100, sum(bool(getattr(r, field)) for field in ("description", "sequence", "obstacles", "instructions")) * 20
                + min(20, db.query(BuildingInstruction).filter_by(route_id=r.id).count() * 10))
            for r in unit_routes
        ) / len(unit_routes), 1) if unit_routes else 0
    available_count = db.query(ExpertAvailability).filter_by(available=True).count()
    return {
        "total_requests": len(requests), "available_experts": available_count,
        "coverage_rate": round(100 * sum(r.status in ("Approved", "Partially Covered") for r in requests) / len(requests), 1) if requests else None,
        "postponed_parcels": sum(r.undelivered for r in reports),
        "completion_rate": round(100 * total_delivered / total_assigned, 1) if total_assigned else None,
        "average_allocation_time_minutes": None, "completion_by_unit": by_unit,
        "request_trends": [{"date": day.isoformat(), "count": sum(r.request_date == day for r in requests)}
                           for day in sorted({r.request_date for r in requests})],
        "allocation_status": status_counts, "failure_reasons": [{"reason": key, "count": value} for key, value in reasons.items()],
        "notebook_completeness": [{"unit": key, "completeness": value} for key, value in completeness.items()],
        "is_demo_data": True,
    }
