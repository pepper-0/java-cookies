"""FastAPI application exposing the crop disease prediction endpoint."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from PIL import UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.model import load_crop_model, predict_crop_disease

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_PATH = Path(
    os.environ.get(
        "CROP_MODEL_WEIGHTS",
        str(BASE_DIR / "weights" / "mobilenetv3_crop_diseases.pth"),
    )
)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Load the checkpoint once when the API process starts."""
    if not WEIGHTS_PATH.is_file():
        raise FileNotFoundError(
            f"Model weights not found at {WEIGHTS_PATH}. "
            "Place mobilenetv3_crop_diseases.pth in the weights/ directory "
            "or set CROP_MODEL_WEIGHTS."
        )

    application.state.model = load_crop_model(str(WEIGHTS_PATH), device=DEVICE)
    application.state.device = DEVICE
    yield


app = FastAPI(title="Crop Disease Identification API", lifespan=lifespan)


@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)):
    """Classify an uploaded crop image."""
    if file.content_type not in {"image/jpeg", "image/png", "image/jpg"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Upload a JPEG or PNG image.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        disease, confidence = await run_in_threadpool(
            predict_crop_disease,
            image_bytes,
            request.app.state.model,
            request.app.state.device,
        )
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from exc
    except Exception as exc:
        logger.exception("Crop disease inference failed")
        raise HTTPException(status_code=500, detail="Inference failed.") from exc

    return {
        "disease": disease,
        "confidence": round(confidence * 100, 2),
        "status": "success",
    }
