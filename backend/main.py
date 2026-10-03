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
    image_uri: str = Field(min_length=1)
    crop: str = Field(min_length=1)
    diagnosis_id: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    severity: str | None = None
    sync_status: Literal["PENDING", "SYNCED"] = "PENDING"


class SyncResponse(BaseModel):
    success: bool = True
    id: str
    sync_status: Literal["SYNCED"] = "SYNCED"


def init_database(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
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

            CREATE TABLE IF NOT EXISTS observations (
              local_id TEXT PRIMARY KEY NOT NULL,
              farmer_id TEXT,
              farm_id TEXT,
              timestamp TEXT NOT NULL,
              image_uri TEXT NOT NULL,
              crop TEXT NOT NULL,
              diagnosis_id TEXT NOT NULL,
              confidence REAL NOT NULL,
              severity TEXT,
              sync_status TEXT NOT NULL,
              received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
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
                  local_id, farmer_id, farm_id, timestamp, image_uri, crop,
                  diagnosis_id, confidence, severity, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
                ON CONFLICT(local_id) DO UPDATE SET
                  farmer_id = excluded.farmer_id,
                  farm_id = excluded.farm_id,
                  timestamp = excluded.timestamp,
                  image_uri = excluded.image_uri,
                  crop = excluded.crop,
                  diagnosis_id = excluded.diagnosis_id,
                  confidence = excluded.confidence,
                  severity = excluded.severity,
                  sync_status = 'SYNCED',
                  received_at = CURRENT_TIMESTAMP
                """,
                (
                    payload.local_id,
                    payload.farmer_id,
                    payload.farm_id,
                    payload.timestamp,
                    payload.image_uri,
                    payload.crop,
                    payload.diagnosis_id,
                    payload.confidence,
                    payload.severity,
                ),
            )
        return SyncResponse(id=payload.local_id)

    @application.get("/observations", response_model=list[ObservationPayload])
    def list_observations(request: Request) -> list[dict[str, object]]:
        with open_database(request) as connection:
            rows = connection.execute(
                """
                SELECT local_id, farmer_id, farm_id, timestamp, image_uri, crop,
                       diagnosis_id, confidence, severity, sync_status
                FROM observations
                ORDER BY timestamp DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    return application


app = create_app()
