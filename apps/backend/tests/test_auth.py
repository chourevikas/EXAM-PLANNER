from fastapi.testclient import TestClient
from app.fastapi_server import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_health_check_docs():
    response = client.get("/docs")
    assert response.status_code == 200
