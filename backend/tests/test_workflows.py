from datetime import date, timedelta


def test_login_and_bad_password(client):
    success = client.post("/api/auth/login", json={
        "email": "director@smartroute.demo", "password": "SmartRoute2026!",
    })
    assert success.status_code == 200
    assert success.json()["user"]["role"] == "director"
    assert client.post("/api/auth/login", json={
        "email": "director@smartroute.demo", "password": "wrong",
    }).status_code == 401


def test_role_permissions_and_unit_filter(client, manager_headers, director_headers):
    assert client.post("/api/allocation/recommendations", headers=manager_headers).status_code == 403
    manager_routes = client.get("/api/routes", headers=manager_headers).json()
    all_routes = client.get("/api/routes", headers=director_headers).json()
    assert len(manager_routes) == 4
    assert len(all_routes) == 12
    assert {route["unit_id"] for route in manager_routes} == {1}
    postman = client.post("/api/auth/login", json={
        "email": "postman1@smartroute.demo", "password": "SmartRoute2026!",
    }).json()
    postman_routes = client.get("/api/routes", headers={
        "Authorization": f"Bearer {postman['access_token']}",
    }).json()
    assert len(postman_routes) == 2
    assert all(route["postman"] == "Facteur 1" for route in postman_routes)


def test_role_restricted_endpoints(client, postman_headers, expert_headers):
    assert client.get("/api/requests", headers=postman_headers).status_code == 403
    assert client.get("/api/delivery-reports", headers=postman_headers).status_code == 403
    assert client.get("/api/analytics", headers=expert_headers).status_code == 403
    assert client.get("/api/delivery-reports", headers=expert_headers).status_code == 200


def test_manager_creates_replacement_request(client, manager_headers, director_headers):
    response = client.post("/api/requests", headers=manager_headers, json={
        "request_date": (date.today() + timedelta(days=5)).isoformat(),
        "absent_employees": 2, "uncovered_rounds": 2, "parcel_volume": 125,
        "backlog": 50, "urgent_deliveries": 18, "route_difficulty": 4,
        "comments": "Automated workflow test",
    })
    assert response.status_code == 200
    records = client.get("/api/requests", headers=director_headers).json()
    assert any(item["id"] == response.json()["id"] and item["status"] == "Pending" for item in records)


def test_manager_creates_and_edits_unit_notebook_building(client, manager_headers, postman_headers):
    created_route = client.post("/api/routes", headers=manager_headers, json={
        "code": "TEST-ROUTE", "name": "Test route", "duration_minutes": 300,
        "parcel_volume": 45, "difficulty": 2, "description": "Test-only route",
    })
    assert created_route.status_code == 200
    route_id = created_route.json()["id"]
    building = client.post("/api/buildings", headers=manager_headers, json={
        "route_id": route_id, "name": "Demo building", "address": "1 Sample Street",
        "access_instructions": "Public access only.",
    })
    assert building.status_code == 200
    building_id = building.json()["id"]
    updated = client.patch(f"/api/buildings/{building_id}", headers=manager_headers, json={
        "delivery_instructions": "Leave with reception.",
    })
    assert updated.status_code == 200
    assert client.get(f"/api/routes/{route_id}", headers=manager_headers).json()["buildings"][0][
        "delivery_instructions"
    ] == "Leave with reception."
    assert client.post("/api/routes", headers=postman_headers, json={
        "code": "NO-ACCESS", "name": "Not allowed",
    }).status_code == 403


def test_priority_weights_are_validated_and_applied(client, director_headers):
    response = client.post("/api/allocation/recommendations", headers=director_headers, json={
        "weights": {"urgency": 0.6, "backlog": 0.2, "workload": 0.1, "difficulty": 0.1},
    })
    assert response.status_code == 200
    assert response.json()["weights"]["urgency"] == 0.6
    invalid = client.post("/api/allocation/recommendations", headers=director_headers, json={
        "weights": {"urgency": 0, "backlog": 0, "workload": 0, "difficulty": 0},
    })
    assert invalid.status_code == 422


def test_allocation_recommendations_and_approval(client, director_headers):
    response = client.post("/api/allocation/recommendations", headers=director_headers)
    assert response.status_code == 200
    recommendations = response.json()["recommendations"]
    assert recommendations
    item = next(row for row in recommendations if row["expert_id"] is not None)
    approval = client.post("/api/allocation/approve", headers=director_headers, json={
        "request_id": item["request_id"], "expert_id": item["expert_id"], "override_reason": "",
    })
    assert approval.status_code == 200, approval.text
    assert approval.json()["status"] == "Assigned"
    assert any(a["request_id"] == item["request_id"] for a in client.get(
        "/api/assignments", headers=director_headers,
    ).json())


def test_double_booking_is_rejected(client, manager_headers, director_headers):
    future = (date.today() + timedelta(days=10)).isoformat()
    request_ids = []
    for _ in range(2):
        created = client.post("/api/requests", headers=manager_headers, json={
            "request_date": future, "absent_employees": 1, "uncovered_rounds": 1,
            "parcel_volume": 40, "backlog": 2, "urgent_deliveries": 0,
            "route_difficulty": 2, "comments": "",
        })
        assert created.status_code == 200
        request_ids.append(created.json()["id"])
    expert = 20
    payload = {"request_id": request_ids[0], "expert_id": expert, "override_reason": "Test override selection."}
    first = client.post("/api/allocation/approve", headers=director_headers, json=payload)
    assert first.status_code == 200, first.text
    second = client.post("/api/allocation/approve", headers=director_headers, json={
        "request_id": request_ids[1], "expert_id": expert, "override_reason": "Test override selection.",
    })
    assert second.status_code == 409


def test_notebook_update_requires_approval_and_records_version(client, postman_headers, manager_headers):
    route_id = client.get("/api/routes", headers=postman_headers).json()[0]["id"]
    proposed = client.post("/api/notebook-changes", headers=postman_headers, json={
        "route_id": route_id, "field": "instructions", "value": "Test-only proposed instruction",
    })
    assert proposed.status_code == 200
    assert any("needs approval" in item["message"] for item in client.get(
        "/api/notifications", headers=manager_headers,
    ).json())
    detail_before = client.get(f"/api/routes/{route_id}", headers=postman_headers).json()
    assert detail_before["route"]["instructions"] != "Test-only proposed instruction"
    change_id = proposed.json()["id"]
    assert client.post(f"/api/notebook-changes/{change_id}/review?decision=approve",
                       headers=manager_headers).status_code == 200
    detail_after = client.get(f"/api/routes/{route_id}", headers=postman_headers).json()
    assert detail_after["route"]["instructions"] == "Test-only proposed instruction"
    history = next(row for row in detail_after["history"] if row["field"] == "instructions")
    assert history["approval_status"] == "Approved"
    assert history["submitted_by"] == "Facteur 1"
    assert history["reviewed_by"] == "Sophie Bernard"
    original_obstacles = detail_after["route"]["obstacles"]
    rejected = client.post("/api/notebook-changes", headers=postman_headers, json={
        "route_id": route_id, "field": "obstacles", "value": "Unverified obstacle",
    })
    assert rejected.status_code == 200
    change_id = rejected.json()["id"]
    review = client.post(f"/api/notebook-changes/{change_id}/review?decision=reject",
                         headers=manager_headers)
    assert review.status_code == 200
    detail_after_rejection = client.get(f"/api/routes/{route_id}", headers=postman_headers).json()
    assert detail_after_rejection["route"]["obstacles"] == original_obstacles
    assert any(item["field"] == "obstacles" and item["approval_status"] == "Rejected"
               for item in detail_after_rejection["history"])


def test_delivery_report_count_validation_and_authorization(client, expert_headers):
    invalid = client.post("/api/delivery-reports", headers=expert_headers, json={
        "allocation_id": 1, "assigned": 10, "delivered": 7, "undelivered": 1,
        "comments": "", "failures": [{"reason": "Other", "parcel_count": 1}],
    })
    assert invalid.status_code == 422
    mismatch = client.post("/api/delivery-reports", headers=expert_headers, json={
        "allocation_id": 1, "assigned": 10, "delivered": 7, "undelivered": 3,
        "comments": "", "failures": [{"reason": "Other", "parcel_count": 1}],
    })
    assert mismatch.status_code == 422


def test_expert_assignment_lifecycle_and_report(client, director_headers, manager_headers):
    request = client.post("/api/requests", headers=manager_headers, json={
        "request_date": (date.today() + timedelta(days=14)).isoformat(),
        "absent_employees": 1, "uncovered_rounds": 1, "parcel_volume": 40,
        "backlog": 2, "urgent_deliveries": 0, "route_difficulty": 2, "comments": "Lifecycle test",
    })
    assert request.status_code == 200
    allocation = client.post("/api/allocation/approve", headers=director_headers, json={
        "request_id": request.json()["id"], "expert_id": 18,
        "override_reason": "Test assignment for delivery lifecycle.",
    })
    assert allocation.status_code == 200, allocation.text
    login = client.post("/api/auth/login", json={
        "email": "expert8@smartroute.demo", "password": "SmartRoute2026!",
    })
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assignments = client.get("/api/assignments", headers=headers).json()
    assignment = next((item for item in assignments if item["status"] == "Assigned" and not item["report_id"]), None)
    assert assignment is not None
    assert client.patch(f"/api/assignments/{assignment['id']}?status=Completed", headers=headers).status_code == 409
    started = client.patch(f"/api/assignments/{assignment['id']}?status=In%20Progress", headers=headers)
    assert started.status_code == 200
    report = client.post("/api/delivery-reports", headers=headers, json={
        "allocation_id": assignment["id"], "assigned": 10, "delivered": 8, "undelivered": 2,
        "comments": "Test report", "failures": [{"reason": "Recipient unavailable", "parcel_count": 2}],
    })
    assert report.status_code == 200
    assert client.get("/api/delivery-reports", headers=headers).status_code == 200


def test_dashboard_uses_records_and_notifications_are_persistent(client, director_headers):
    before = client.get("/api/analytics", headers=director_headers).json()
    assert before["is_demo_data"] is True
    assert before["total_requests"] >= 9
    notes = client.get("/api/notifications", headers=director_headers).json()
    assert notes
    note = notes[0]
    marked = client.patch(f"/api/notifications/{note['id']}/read", headers=director_headers)
    assert marked.status_code == 200 and marked.json()["read"] is True


def test_analytics_filters_and_unit_scope(client, director_headers, manager_headers):
    filtered = client.get("/api/analytics?unit_id=1", headers=director_headers)
    assert filtered.status_code == 200
    assert {row["unit"] for row in filtered.json()["completion_by_unit"]} <= {"Paris Rive Gauche"}
    manager_view = client.get("/api/analytics?unit_id=2", headers=manager_headers)
    assert manager_view.status_code == 200
    assert {row["unit"] for row in manager_view.json()["completion_by_unit"]} <= {"Paris Rive Gauche"}
    invalid_range = client.get("/api/analytics?start_date=2026-10-31&end_date=2026-10-30",
                               headers=director_headers)
    assert invalid_range.status_code == 422


def test_recommendations_handle_no_available_experts(client, director_headers):
    availability = client.get("/api/availability", headers=director_headers).json()
    for expert in availability:
        response = client.patch(f"/api/availability/{expert['user_id']}?available=false", headers=director_headers)
        assert response.status_code == 200
    result = client.post("/api/allocation/recommendations", headers=director_headers).json()
    assert result["recommendations"]
    assert all(item["expert_id"] is None for item in result["recommendations"])


def test_notebook_search_and_unknown_search_message(client, expert_headers):
    assignment = client.get("/api/assignments", headers=expert_headers).json()[0]
    result = client.get(f"/api/routes/{assignment['route_id']}/search?q=hall", headers=expert_headers)
    assert result.status_code == 200
    assert result.json()["results"]
    missing = client.get(f"/api/routes/{assignment['route_id']}/search?q=never-recorded-term", headers=expert_headers)
    assert missing.json()["message"] == "No matching information is recorded in this notebook."
