from datetime import date

from sqlalchemy.orm import Session

from ..models import Allocation, ExpertAvailability, PostalUnit, ReplacementRequest, User


DEFAULT_WEIGHTS = {"urgency": 0.30, "backlog": 0.30, "workload": 0.25, "difficulty": 0.15}


def rank_requests(db: Session, weights: dict | None = None):
    weights = weights or DEFAULT_WEIGHTS
    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise ValueError("Allocation weights must sum to a positive value")
    normalized = {key: value / total_weight for key, value in weights.items()}
    requests = db.query(ReplacementRequest).filter(
        ReplacementRequest.status.in_(["Pending", "Under Review"])
    ).order_by(ReplacementRequest.id).all()
    max_backlog = max([r.backlog for r in requests] + [1])
    max_urgent = max([r.urgent_deliveries for r in requests] + [1])
    max_workload = max([r.absent_employees + r.uncovered_rounds for r in requests] + [1])
    available = db.query(ExpertAvailability).join(User).filter(
        ExpertAvailability.available.is_(True), User.active.is_(True), User.role == "expert"
    ).all()
    scored = []
    for request in requests:
        urgency = min(request.urgent_deliveries / max_urgent, 1)
        backlog = min(request.backlog / max_backlog, 1)
        workload = min((request.absent_employees + request.uncovered_rounds) / max_workload, 1)
        difficulty = (request.route_difficulty - 1) / 4
        score = 100 * (
            urgency * normalized["urgency"] + backlog * normalized["backlog"]
            + workload * normalized["workload"] + difficulty * normalized["difficulty"]
        )
        scored.append({
            "request_id": request.id, "unit_id": request.unit_id,
            "unit_name": db.get(PostalUnit, request.unit_id).name,
            "request_date": request.request_date.isoformat(),
            "uncovered_rounds": request.uncovered_rounds, "parcel_volume": request.parcel_volume,
            "backlog": request.backlog, "urgent_deliveries": request.urgent_deliveries,
            "route_difficulty": request.route_difficulty, "status": request.status,
            "priority_score": round(score, 1),
            "priority": "Critical" if score >= 75 else "High" if score >= 50 else "Medium" if score >= 25 else "Low",
            "expert_id": None,
            "expert_name": None,
            "reasoning": (
                f"Urgency {urgency:.0%} × {normalized['urgency']:.0%}; backlog {backlog:.0%} × "
                f"{normalized['backlog']:.0%}; workload {workload:.0%} × {normalized['workload']:.0%}; "
                f"difficulty {difficulty:.0%} × {normalized['difficulty']:.0%}."
            ),
        })
    ranked = sorted(scored, key=lambda row: row["priority_score"], reverse=True)
    reserved_by_date: dict[date, set[int]] = {}
    for row in ranked:
        request = next(record for record in requests if record.id == row["request_id"])
        booked = reserved_by_date.setdefault(request.request_date, {
            booked_id for (booked_id,) in db.query(Allocation.expert_id).filter(
                Allocation.assignment_date == request.request_date,
                Allocation.status.in_(["Assigned", "In Progress"]),
            ).all()
        })
        eligible = [candidate for candidate in available
                    if candidate.user_id not in booked
                    and candidate.preferred_unit_id in (None, request.unit_id)]
        row["eligible_experts"] = [
            {"user_id": candidate.user_id, "name": db.get(User, candidate.user_id).name}
            for candidate in eligible
        ]
        selected = eligible[0] if eligible else None
        if selected:
            row["expert_id"] = selected.user_id
            row["expert_name"] = db.get(User, selected.user_id).name
            booked.add(selected.user_id)
    return ranked
