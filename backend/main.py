from __future__ import annotations

import json
import os
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import Iterator, Literal

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


DEFAULT_DATABASE_PATH = Path(__file__).parent / "database" / "limadrc.db"
DATABASE_VERSION = 2

OBSERVATION_COLUMNS = (
    "local_id",
    "farmer_id",
    "farm_id",
    "timestamp",
    "crop",
    "diagnosis_id",
    "confidence",
    "sync_status",
    "received_at",
)

CREATE_OBSERVATIONS_TABLE_SQL = """
CREATE TABLE observations (
  local_id TEXT PRIMARY KEY NOT NULL,
  farmer_id TEXT,
  farm_id TEXT,
  timestamp TEXT NOT NULL,
  crop TEXT NOT NULL,
  diagnosis_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  sync_status TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


class FarmerPayload(BaseModel):
    local_id: str = Field(min_length=1)
    external_registry_id: str | None = None
    name: str = Field(min_length=1)
    province: str = ""
    territory: str = ""
    village: str = ""
    preferred_language: str = ""
    sync_status: Literal["PENDING", "SYNCED"] = "PENDING"


class FarmPayload(BaseModel):
    local_id: str = Field(min_length=1)
    farmer_id: str = Field(min_length=1)
    primary_crops: list[str] = Field(default_factory=list)
    latitude: float | None = None
    longitude: float | None = None
    sync_status: Literal["PENDING", "SYNCED"] = "PENDING"


class ObservationPayload(BaseModel):
    local_id: str = Field(min_length=1)
    farmer_id: str | None = None
    farm_id: str | None = None
    timestamp: str = Field(min_length=1)
    crop: str = Field(min_length=1)
    diagnosis_id: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    sync_status: Literal["PENDING", "SYNCED"] = "PENDING"


class SyncResponse(BaseModel):
    success: bool = True
    id: str
    sync_status: Literal["SYNCED"] = "SYNCED"


def init_database(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        current_version = connection.execute("PRAGMA user_version").fetchone()[0]
        if current_version > DATABASE_VERSION:
            raise RuntimeError(
                "This database was created by a newer version of LimaDRC."
            )

        connection.executescript(
            f"""
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS farmers (
              local_id TEXT PRIMARY KEY NOT NULL,
              external_registry_id TEXT,
              name TEXT NOT NULL,
              province TEXT NOT NULL,
              territory TEXT NOT NULL,
              village TEXT NOT NULL,
              preferred_language TEXT NOT NULL,
              sync_status TEXT NOT NULL,
              received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS farms (
              local_id TEXT PRIMARY KEY NOT NULL,
              farmer_id TEXT NOT NULL,
              primary_crops TEXT NOT NULL,
              latitude REAL,
              longitude REAL,
              sync_status TEXT NOT NULL,
              received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            {CREATE_OBSERVATIONS_TABLE_SQL.replace("CREATE TABLE observations", "CREATE TABLE IF NOT EXISTS observations")};
            """
        )
        if current_version < DATABASE_VERSION:
            normalize_observations_table(connection)
            connection.execute("VACUUM")
            connection.execute(f"PRAGMA user_version = {DATABASE_VERSION}")


def normalize_observations_table(connection: sqlite3.Connection) -> None:
    column_names = tuple(
        row[1] for row in connection.execute("PRAGMA table_info(observations)")
    )
    if column_names == OBSERVATION_COLUMNS:
        return

    missing_columns = [
        column for column in OBSERVATION_COLUMNS if column not in column_names
    ]
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise RuntimeError(f"Observation database is missing required columns: {missing}")

    selected_columns = ", ".join(OBSERVATION_COLUMNS)
    connection.executescript(
        f"""
        BEGIN IMMEDIATE;
        ALTER TABLE observations RENAME TO observations_outdated;
        {CREATE_OBSERVATIONS_TABLE_SQL};
        INSERT INTO observations ({selected_columns})
        SELECT {selected_columns} FROM observations_outdated;
        DROP TABLE observations_outdated;
        COMMIT;
        """
    )


@contextmanager
def open_database(request: Request) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(request.app.state.database_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def create_app(database_path: str | Path | None = None) -> FastAPI:
    configured_path = Path(
        database_path
        or os.environ.get("LIMADRC_DATABASE_PATH", DEFAULT_DATABASE_PATH)
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        init_database(application.state.database_path)
        yield

    application = FastAPI(
        title="LimaDRC Prototype API",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.database_path = configured_path
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "limadrc-prototype"}

    @application.post("/farmers", response_model=SyncResponse)
    def save_farmer(payload: FarmerPayload, request: Request) -> SyncResponse:
        with open_database(request) as connection:
            connection.execute(
                """
                INSERT INTO farmers (
                  local_id, external_registry_id, name, province, territory,
                  village, preferred_language, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')
                ON CONFLICT(local_id) DO UPDATE SET
                  external_registry_id = excluded.external_registry_id,
                  name = excluded.name,
                  province = excluded.province,
                  territory = excluded.territory,
                  village = excluded.village,
                  preferred_language = excluded.preferred_language,
                  sync_status = 'SYNCED',
                  received_at = CURRENT_TIMESTAMP
                """,
                (
                    payload.local_id,
                    payload.external_registry_id,
                    payload.name,
                    payload.province,
                    payload.territory,
                    payload.village,
                    payload.preferred_language,
                ),
            )
        return SyncResponse(id=payload.local_id)

    @application.post("/farms", response_model=SyncResponse)
    def save_farm(payload: FarmPayload, request: Request) -> SyncResponse:
        with open_database(request) as connection:
            connection.execute(
                """
                INSERT INTO farms (
                  local_id, farmer_id, primary_crops, latitude, longitude, sync_status
                ) VALUES (?, ?, ?, ?, ?, 'SYNCED')
                ON CONFLICT(local_id) DO UPDATE SET
                  farmer_id = excluded.farmer_id,
                  primary_crops = excluded.primary_crops,
                  latitude = excluded.latitude,
                  longitude = excluded.longitude,
                  sync_status = 'SYNCED',
                  received_at = CURRENT_TIMESTAMP
                """,
                (
                    payload.local_id,
                    payload.farmer_id,
                    json.dumps(payload.primary_crops),
                    payload.latitude,
                    payload.longitude,
                ),
            )
        return SyncResponse(id=payload.local_id)

    @application.post("/observations", response_model=SyncResponse)
    def save_observation(payload: ObservationPayload, request: Request) -> SyncResponse:
        with open_database(request) as connection:
            connection.execute(
                """
                INSERT INTO observations (
                  local_id, farmer_id, farm_id, timestamp, crop,
                  diagnosis_id, confidence, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')
                ON CONFLICT(local_id) DO UPDATE SET
                  farmer_id = excluded.farmer_id,
                  farm_id = excluded.farm_id,
                  timestamp = excluded.timestamp,
                  crop = excluded.crop,
                  diagnosis_id = excluded.diagnosis_id,
                  confidence = excluded.confidence,
                  sync_status = 'SYNCED',
                  received_at = CURRENT_TIMESTAMP
                """,
                (
                    payload.local_id,
                    payload.farmer_id,
                    payload.farm_id,
                    payload.timestamp,
                    payload.crop,
                    payload.diagnosis_id,
                    payload.confidence,
                ),
            )
        return SyncResponse(id=payload.local_id)

    @application.get("/observations", response_model=list[ObservationPayload])
    def list_observations(request: Request) -> list[dict[str, object]]:
        with open_database(request) as connection:
            rows = connection.execute(
                """
                SELECT local_id, farmer_id, farm_id, timestamp, crop,
                       diagnosis_id, confidence, sync_status
                FROM observations
                ORDER BY timestamp DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    return application


app = create_app()
