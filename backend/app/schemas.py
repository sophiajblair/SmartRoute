from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class LoginInput(BaseModel):
    email: str
    password: str


class RequestInput(BaseModel):
    request_date: date
    absent_employees: int = Field(ge=0)
    uncovered_rounds: int = Field(ge=0)
    parcel_volume: int = Field(ge=0)
    backlog: int = Field(ge=0)
    urgent_deliveries: int = Field(ge=0)
    route_difficulty: int = Field(ge=1, le=5)
    comments: str = Field(default="", max_length=2000)


class NotebookChangeInput(BaseModel):
    route_id: int
    field: str = Field(pattern=r"^(description|sequence|obstacles|instructions)$")
    value: str = Field(min_length=1, max_length=5000)


class RouteCreateInput(BaseModel):
    code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9-]+$")
    name: str = Field(min_length=2, max_length=120)
    duration_minutes: int = Field(default=360, ge=30, le=1000)
    parcel_volume: int = Field(default=0, ge=0, le=10000)
    difficulty: int = Field(default=3, ge=1, le=5)
    description: str = Field(default="", max_length=5000)


class BuildingInput(BaseModel):
    route_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(min_length=1, max_length=200)
    entrance: str = Field(default="", max_length=200)
    access_instructions: str = Field(default="", max_length=3000)
    delivery_instructions: str = Field(default="", max_length=3000)
    difficulties: str = Field(default="", max_length=3000)
    notes: str = Field(default="", max_length=3000)


class BuildingUpdateInput(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = Field(default=None, min_length=1, max_length=200)
    entrance: str | None = Field(default=None, max_length=200)
    access_instructions: str | None = Field(default=None, max_length=3000)
    delivery_instructions: str | None = Field(default=None, max_length=3000)
    difficulties: str | None = Field(default=None, max_length=3000)
    notes: str | None = Field(default=None, max_length=3000)


class ScoringWeights(BaseModel):
    urgency: float = Field(ge=0, le=1)
    backlog: float = Field(ge=0, le=1)
    workload: float = Field(ge=0, le=1)
    difficulty: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def positive_sum(self):
        if sum(self.model_dump().values()) <= 0:
            raise ValueError("Allocation weights must sum to a positive value")
        return self


class RecommendationsInput(BaseModel):
    weights: ScoringWeights | None = None


class IssueInput(BaseModel):
    route_id: int
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=3, max_length=3000)
    category: str = Field(default="Access", max_length=50)
    priority: str = Field(default="Medium", pattern=r"^(Low|Medium|High|Critical)$")


class AllocationInput(BaseModel):
    request_id: int
    expert_id: int
    route_id: int | None = None
    override_reason: str = Field(default="", max_length=1000)
    weights: ScoringWeights | None = None


class FailureInput(BaseModel):
    reason: Literal[
        "Incorrect address", "Building inaccessible", "Navigation difficulty",
        "Insufficient time", "Recipient unavailable", "Other",
    ]
    parcel_count: int = Field(gt=0)


class DeliveryInput(BaseModel):
    allocation_id: int
    assigned: int = Field(ge=0)
    delivered: int = Field(ge=0)
    undelivered: int = Field(ge=0)
    comments: str = Field(default="", max_length=2000)
    failures: list[FailureInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_counts(self):
        if self.delivered + self.undelivered != self.assigned:
            raise ValueError("Delivered plus undelivered parcels must equal assigned parcels")
        if sum(item.parcel_count for item in self.failures) != self.undelivered:
            raise ValueError("Failure reason counts must equal undelivered parcels")
        return self
