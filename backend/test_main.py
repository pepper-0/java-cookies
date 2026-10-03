from pathlib import Path

from fastapi.testclient import TestClient

from main import create_app


def test_checkpoint_endpoints(tmp_path: Path) -> None:
    app = create_app(tmp_path / "checkpoint.db")

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        farmer = {
            "local_id": "farmer-1",
            "external_registry_id": None,
            "name": "Marie Kabeya",
            "province": "Kasai-Central",
            "territory": "Demba",
            "village": "Lusambo",
            "preferred_language": "Francais",
            "sync_status": "PENDING",
        }
        assert client.post("/farmers", json=farmer).json() == {
            "success": True,
            "id": "farmer-1",
            "sync_status": "SYNCED",
        }

        farm = {
            "local_id": "farm-1",
            "farmer_id": "farmer-1",
            "primary_crops": ["cassava", "maize"],
            "latitude": None,
            "longitude": None,
            "sync_status": "PENDING",
        }
        assert client.post("/farms", json=farm).status_code == 200

        observation = {
            "local_id": "observation-1",
            "farmer_id": "farmer-1",
            "farm_id": "farm-1",
            "timestamp": "2026-10-03T12:00:00Z",
            "image_uri": "file:///local/cassava.jpg",
            "crop": "cassava",
            "diagnosis_id": "cassava_mosaic_disease",
            "confidence": 0.92,
            "severity": "moderate",
            "sync_status": "PENDING",
        }
        first_post = client.post("/observations", json=observation)
        second_post = client.post("/observations", json=observation)
        assert first_post.status_code == 200
        assert second_post.status_code == 200

        saved = client.get("/observations")
        assert saved.status_code == 200
        assert len(saved.json()) == 1
        assert saved.json()[0]["sync_status"] == "SYNCED"
