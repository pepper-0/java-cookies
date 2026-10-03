from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PROJECT_ROOT.parent


@dataclass(frozen=True)
class ClassDefinition:
    index: int
    crop: str
    diagnosis_id: str
    display_name: str


@dataclass(frozen=True)
class TrainingConfig:
    seed: int
    image_height: int
    image_width: int
    batch_size: int
    validation_fraction: float
    test_fraction: float
    minimum_images_per_class: int
    head_epochs: int
    fine_tune_epochs: int
    head_learning_rate: float
    fine_tune_learning_rate: float
    fine_tune_layers: int
    dropout_rate: float
    early_stopping_patience: int

    @property
    def image_size(self) -> tuple[int, int]:
        return (self.image_height, self.image_width)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Required file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON in {path}: {error}") from error


def load_classes(path: Path = PROJECT_ROOT / "classes.json") -> list[ClassDefinition]:
    payload = _read_json(path)
    raw_classes = payload.get("classes") if isinstance(payload, dict) else None
    if not isinstance(raw_classes, list):
        raise ValueError(f"{path} must contain a classes array.")

    try:
        classes = [ClassDefinition(**item) for item in raw_classes]
    except (TypeError, KeyError) as error:
        raise ValueError(f"Every class in {path} must define index, crop, diagnosis_id, and display_name.") from error

    expected_indexes = list(range(len(classes)))
    actual_indexes = [item.index for item in classes]
    if actual_indexes != expected_indexes:
        raise ValueError(f"Class indexes must be consecutive and ordered: expected {expected_indexes}.")
    if len(classes) != 15:
        raise ValueError(f"The LimaDRC model contract requires exactly 15 classes; found {len(classes)}.")

    diagnosis_ids = [item.diagnosis_id for item in classes]
    if len(diagnosis_ids) != len(set(diagnosis_ids)):
        raise ValueError("diagnosis_id values must be unique.")

    expected_crops = {"maize", "cassava", "rice"}
    if {item.crop for item in classes} != expected_crops:
        raise ValueError(f"Classes must cover exactly these crops: {sorted(expected_crops)}.")
    for crop in expected_crops:
        crop_classes = [item for item in classes if item.crop == crop]
        if len(crop_classes) != 5:
            raise ValueError(f"{crop} must have exactly five classes.")
        if sum(item.diagnosis_id == f"{crop}_unknown" for item in crop_classes) != 1:
            raise ValueError(f"{crop} must have exactly one crop-specific Unknown class.")

    return classes


def load_config(path: Path = PROJECT_ROOT / "config.json") -> TrainingConfig:
    payload = _read_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    try:
        config = TrainingConfig(**payload)
    except TypeError as error:
        raise ValueError(f"Invalid or missing training configuration in {path}: {error}") from error

    if config.image_height <= 0 or config.image_width <= 0:
        raise ValueError("Image dimensions must be positive.")
    if config.batch_size <= 0:
        raise ValueError("batch_size must be positive.")
    if config.minimum_images_per_class < 3:
        raise ValueError("minimum_images_per_class must be at least 3 for train/validation/test splits.")
    if not 0 < config.validation_fraction < 1 or not 0 < config.test_fraction < 1:
        raise ValueError("Validation and test fractions must each be between 0 and 1.")
    if config.validation_fraction + config.test_fraction >= 1:
        raise ValueError("Validation and test fractions must leave data for training.")
    if not 0 <= config.dropout_rate < 1:
        raise ValueError("dropout_rate must be at least 0 and below 1.")
    if config.fine_tune_layers <= 0:
        raise ValueError("fine_tune_layers must be positive.")
    if config.head_epochs <= 0 or config.fine_tune_epochs <= 0:
        raise ValueError("Both training stages must have at least one epoch.")
    if config.head_learning_rate <= 0 or config.fine_tune_learning_rate <= 0:
        raise ValueError("Learning rates must be positive.")

    return config


def validate_mobile_labels(
    classes: list[ClassDefinition],
    path: Path = REPOSITORY_ROOT / "mobile" / "src" / "ml" / "labels.json",
) -> None:
    labels = _read_json(path)
    if not isinstance(labels, dict):
        raise ValueError(f"{path} must contain an index-to-label object.")
    expected = {str(item.index): item.diagnosis_id for item in classes}
    if labels != expected:
        raise ValueError(
            f"Mobile labels do not match {PROJECT_ROOT / 'classes.json'}. Regenerate {path}."
        )
