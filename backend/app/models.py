from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    role: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("postal_units.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PostalUnit(Base):
    __tablename__ = "postal_units"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)


class DeliveryRoute(Base):
    __tablename__ = "delivery_routes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_id: Mapped[int] = mapped_column(ForeignKey("postal_units.id"), nullable=False)
    postman_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=360)
    parcel_volume: Mapped[int] = mapped_column(Integer, default=85)
    difficulty: Mapped[int] = mapped_column(Integer, default=3)
    description: Mapped[str] = mapped_column(Text, default="")
    sequence: Mapped[str] = mapped_column(Text, default="")
    obstacles: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    manager_contact: Mapped[str] = mapped_column(String(160), default="")
    support_contact: Mapped[str] = mapped_column(String(160), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class BuildingInstruction(Base):
    __tablename__ = "building_instructions"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("delivery_routes.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    address: Mapped[str] = mapped_column(String(200), nullable=False)
    entrance: Mapped[str] = mapped_column(String(200), default="")
    access_instructions: Mapped[str] = mapped_column(Text, default="")
    delivery_instructions: Mapped[str] = mapped_column(Text, default="")
    difficulties: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class NotebookChangeRequest(Base):
    __tablename__ = "notebook_change_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("delivery_routes.id"), index=True)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    field: Mapped[str] = mapped_column(String(60), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending Approval", index=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotebookVersion(Base):
    __tablename__ = "notebook_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("delivery_routes.id"), index=True)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    field: Mapped[str] = mapped_column(String(60), nullable=False)
    old_value: Mapped[str] = mapped_column(Text, default="")
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(30), default="Approved")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class RouteIssue(Base):
    __tablename__ = "route_issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("delivery_routes.id"), index=True)
    reported_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="Access")
    priority: Mapped[str] = mapped_column(String(20), default="Medium")
    status: Mapped[str] = mapped_column(String(30), default="Open", index=True)
    resolution: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ReplacementRequest(Base):
    __tablename__ = "replacement_requests"
    __table_args__ = (
        CheckConstraint("absent_employees >= 0 AND uncovered_rounds >= 0 AND parcel_volume >= 0 AND backlog >= 0"),
        Index("ix_request_unit_date", "unit_id", "request_date"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("postal_units.id"), nullable=False)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    request_date: Mapped[object] = mapped_column(Date, nullable=False)
    absent_employees: Mapped[int] = mapped_column(Integer, default=1)
    uncovered_rounds: Mapped[int] = mapped_column(Integer, default=1)
    parcel_volume: Mapped[int] = mapped_column(Integer, default=0)
    backlog: Mapped[int] = mapped_column(Integer, default=0)
    urgent_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    route_difficulty: Mapped[int] = mapped_column(Integer, default=3)
    comments: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ExpertAvailability(Base):
    __tablename__ = "expert_availability"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    skills: Mapped[str] = mapped_column(Text, default="")
    preferred_unit_id: Mapped[int | None] = mapped_column(ForeignKey("postal_units.id"))


class Allocation(Base):
    __tablename__ = "allocations"
    __table_args__ = (Index("ix_allocation_date_expert", "assignment_date", "expert_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("replacement_requests.id"), nullable=False)
    expert_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_routes.id"))
    assignment_date: Mapped[object] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Assigned", index=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    reasoning: Mapped[str] = mapped_column(Text, default="")
    override_reason: Mapped[str] = mapped_column(Text, default="")
    allocated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)


class DeliveryReport(Base):
    __tablename__ = "delivery_reports"
    __table_args__ = (CheckConstraint("delivered >= 0 AND undelivered >= 0 AND assigned = delivered + undelivered"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    allocation_id: Mapped[int] = mapped_column(ForeignKey("allocations.id"), unique=True, nullable=False)
    assigned: Mapped[int] = mapped_column(Integer, nullable=False)
    delivered: Mapped[int] = mapped_column(Integer, nullable=False)
    undelivered: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class DeliveryFailureReason(Base):
    __tablename__ = "delivery_failure_reasons"
    __table_args__ = (CheckConstraint("parcel_count > 0"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("delivery_reports.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(60), nullable=False)
    parcel_count: Mapped[int] = mapped_column(Integer, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    message: Mapped[str] = mapped_column(String(300), nullable=False)
    link: Mapped[str] = mapped_column(String(200), default="/")
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
