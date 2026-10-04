import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from main import OBSERVATION_COLUMNS, create_app, init_database


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
            "crop": "cassava",
            "diagnosis_id": "cassava_mosaic_disease",
            "confidence": 0.92,
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
        assert set(saved.json()[0]) == {
            "local_id",
            "farmer_id",
            "farm_id",
            "timestamp",
            "crop",
            "diagnosis_id",
            "confidence",
            "sync_status",
        }


def test_init_database_removes_obsolete_observation_columns(tmp_path: Path) -> None:
    database_path = tmp_path / "outdated.db"
    init_database(database_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO observations (
              local_id, timestamp, crop, diagnosis_id,
              confidence, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "preserved-observation",
                "2026-10-03T11:00:00Z",
                "maize",
                "maize_healthy",
                0.88,
                "PENDING",
            ),
        )
        connection.execute("ALTER TABLE observations ADD COLUMN obsolete_field TEXT")
        connection.execute("PRAGMA user_version = 1")

    init_database(database_path)
    with sqlite3.connect(database_path) as connection:
        column_names = tuple(
            row[1] for row in connection.execute("PRAGMA table_info(observations)")
        )
        preserved_rows = connection.execute(
            "SELECT local_id FROM observations ORDER BY timestamp"
        ).fetchall()

    assert column_names == OBSERVATION_COLUMNS
    assert preserved_rows == [("preserved-observation",)]

    app = create_app(database_path)
    observation = {
        "local_id": "legacy-observation-1",
        "farmer_id": None,
        "farm_id": None,
        "timestamp": "2026-10-03T12:00:00Z",
        "crop": "cassava",
        "diagnosis_id": "cassava_mosaic_disease",
        "confidence": 0.92,
        "sync_status": "PENDING",
    }

    with TestClient(app) as client:
        assert client.post("/observations", json=observation).status_code == 200
        saved_observation = client.get("/observations").json()[0]
        assert saved_observation["diagnosis_id"] == "cassava_mosaic_disease"
        assert set(saved_observation) == {
            "local_id",
            "farmer_id",
            "farm_id",
            "timestamp",
            "crop",
            "diagnosis_id",
            "confidence",
            "sync_status",
        }
