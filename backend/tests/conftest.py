import os
import tempfile
import uuid

os.environ["SMARTROUTE_DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/smartroute-test-{uuid.uuid4().hex}.db"
os.environ["SMARTROUTE_SECRET_KEY"] = "test-secret-key-not-for-production"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def auth(client, email):
    response = client.post("/api/auth/login", json={"email": email, "password": "SmartRoute2026!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def director_headers(client):
    return auth(client, "director@smartroute.demo")


@pytest.fixture
def manager_headers(client):
    return auth(client, "manager1@smartroute.demo")


@pytest.fixture
def postman_headers(client):
    return auth(client, "postman1@smartroute.demo")


@pytest.fixture
def expert_headers(client):
    return auth(client, "expert1@smartroute.demo")
