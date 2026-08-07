"""Lightweight analytics: detail views increment view_count / last_viewed_at,
and the list payload carries the trend fields (view_count, first_ats)."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _upload(client: TestClient, headers: dict) -> dict:
    resp = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_detail_view_increments_view_count(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)

    first = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert first["view_count"] == 1
    assert first["last_viewed_at"] is not None

    second = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert second["view_count"] == 2


def test_list_carries_view_count_and_analytics_fields(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    client.post(f"/api/resumes/{data['id']}/analyze", headers=headers)

    listing = client.get("/api/resumes", headers=headers).json()
    item = next(i for i in listing if i["id"] == data["id"])
    assert item["view_count"] == 0  # detail GET (the view) hasn't been called yet
    assert item["first_ats"] is not None
    assert item["version_count"] == 1


def test_other_users_view_is_404_and_does_not_count(client, auth):
    owner = auth()
    other = auth()
    data = _upload(client, owner["headers"])

    assert client.get(f"/api/resumes/{data['id']}", headers=other["headers"]).status_code == 404
    detail = client.get(f"/api/resumes/{data['id']}", headers=owner["headers"]).json()
    assert detail["view_count"] == 1
