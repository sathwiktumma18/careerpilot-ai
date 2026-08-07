"""Resume versioning: add a version, analyze a specific one, list/detail shape,
cascade delete, and ownership isolation."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _upload(client: TestClient, headers: dict, name: str = "jane_doe.pdf") -> dict:
    resp = client.post(
        "/api/resumes",
        files={"file": (name, resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_version(client: TestClient, headers: dict, resume_id: str, name: str = "v2.pdf") -> dict:
    resp = client.post(
        f"/api/resumes/{resume_id}/versions",
        files={"file": (name, resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_upload_starts_at_version_1(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    detail = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert detail["version_count"] == 1
    assert detail["current_version_no"] == 1
    assert [v["version_no"] for v in detail["versions"]] == [1]
    assert detail["title"] == "jane_doe.pdf"


def test_add_version_bumps_current_and_preserves_v1(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    client.post(f"/api/resumes/{data['id']}/analyze", headers=headers)

    v2 = _add_version(client, headers, data["id"])
    assert v2["version_no"] == 2
    assert v2["file_name"] == "v2.pdf"

    detail = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert detail["version_count"] == 2
    assert detail["current_version_no"] == 2
    nums = [v["version_no"] for v in detail["versions"]]
    assert nums == [1, 2]
    # v1's analysis is preserved after a new version is added.
    v1, v2_info = detail["versions"]
    assert v1["version_no"] == 1
    assert v1["ats_score"] is not None
    assert v2_info["ats_score"] is None  # not analyzed yet
    # The list shows one group, with the latest version as the headline.
    listing = client.get("/api/resumes", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["version_count"] == 2
    assert listing[0]["first_ats"] == v1["ats_score"]


def test_analyze_specific_version_does_not_clobber_others(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    client.post(f"/api/resumes/{data['id']}/analyze", headers=headers)
    _add_version(client, headers, data["id"])

    # Analyze only v2; v1 must keep its original score.
    resp = client.post(f"/api/resumes/{data['id']}/analyze?version=2", headers=headers)
    assert resp.status_code == 200, resp.text
    v1_score = resp.json()["ats_score"]

    detail = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert detail["versions"][0]["ats_score"] == v1_score
    assert detail["versions"][1]["ats_score"] == v1_score  # v2 == v1 (same text)


def test_analyze_unknown_version_returns_404(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    resp = client.post(f"/api/resumes/{data['id']}/analyze?version=99", headers=headers)
    assert resp.status_code == 404


def test_add_version_to_foreign_resume_is_404(client, auth):
    owner = auth()
    other = auth()
    data = _upload(client, owner["headers"])
    resp = client.post(
        f"/api/resumes/{data['id']}/versions",
        files={"file": ("x.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=other["headers"],
    )
    assert resp.status_code == 404


def test_versions_require_pdf(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    resp = client.post(
        f"/api/resumes/{data['id']}/versions",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_delete_cascades_versions(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    _add_version(client, headers, data["id"])

    assert client.delete(f"/api/resumes/{data['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/resumes/{data['id']}", headers=headers).status_code == 404
    listing = client.get("/api/resumes", headers=headers).json()
    assert all(item["id"] != data["id"] for item in listing)
