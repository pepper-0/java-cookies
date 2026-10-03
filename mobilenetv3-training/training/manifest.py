from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path

from training.contract import ClassDefinition, PROJECT_ROOT, TrainingConfig


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class ImageRecord:
    relative_path: str
    class_index: int
    diagnosis_id: str
    crop: str
    group_id: str
    split: str = ""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_group_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    with path.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames != ["relative_path", "group_id"]:
            raise ValueError(
                f"{path} must have exactly these columns: relative_path,group_id"
            )
        mapping: dict[str, str] = {}
        for row in reader:
            relative_path = row["relative_path"].strip()
            group_id = row["group_id"].strip()
            if not relative_path or not group_id:
                raise ValueError(f"Blank relative_path or group_id in {path}.")
            if relative_path in mapping:
                raise ValueError(f"Duplicate relative_path in {path}: {relative_path}")
            mapping[relative_path] = group_id
    return mapping


def discover_images(
    classes: list[ClassDefinition],
    config: TrainingConfig,
    dataset_root: Path = PROJECT_ROOT / "datasets" / "raw",
    groups_path: Path = PROJECT_ROOT / "datasets" / "groups.csv",
) -> tuple[list[ImageRecord], list[str]]:
    group_map = _read_group_map(groups_path)
    records: list[ImageRecord] = []
    warnings: list[str] = []
    missing_directories: list[str] = []
    empty_classes: list[str] = []
    hashes: dict[str, str] = {}
    seen_relative_paths: set[str] = set()

    for class_definition in classes:
        class_directory = dataset_root / class_definition.diagnosis_id
        if not class_directory.is_dir():
            missing_directories.append(class_definition.diagnosis_id)
            continue

        image_paths = sorted(
            path
            for path in class_directory.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        )
        if not image_paths:
            empty_classes.append(class_definition.diagnosis_id)
            continue
        if len(image_paths) < config.minimum_images_per_class:
            raise ValueError(
                f"{class_definition.diagnosis_id} has {len(image_paths)} images; "
                f"at least {config.minimum_images_per_class} are required by config.json."
            )

        for image_path in image_paths:
            relative_path = image_path.relative_to(PROJECT_ROOT).as_posix()
            image_hash = _sha256(image_path)
            if image_hash in hashes:
                raise ValueError(
                    "Duplicate image content detected. "
                    f"{relative_path} duplicates {hashes[image_hash]}."
                )
            hashes[image_hash] = relative_path
            seen_relative_paths.add(relative_path)
            records.append(
                ImageRecord(
                    relative_path=relative_path,
                    class_index=class_definition.index,
                    diagnosis_id=class_definition.diagnosis_id,
                    crop=class_definition.crop,
                    group_id=group_map.get(relative_path, relative_path),
                )
            )

    if missing_directories:
        raise ValueError(
            "Dataset directories are missing for: " + ", ".join(missing_directories)
        )
    if empty_classes:
        raise ValueError("No supported images found for: " + ", ".join(empty_classes))

    unknown_group_paths = sorted(set(group_map) - seen_relative_paths)
    if unknown_group_paths:
        raise ValueError(
            f"{groups_path} references files not found in the dataset: "
            + ", ".join(unknown_group_paths[:10])
        )
    if not group_map:
        warnings.append(
            "No datasets/groups.csv was provided. Each file will be treated as an independent "
            "capture group; add group metadata before production training to keep images from the "
            "same plant or capture session in a single split."
        )

    groups_to_classes: dict[str, set[int]] = defaultdict(set)
    for record in records:
        groups_to_classes[record.group_id].add(record.class_index)
    mixed_groups = [group for group, indexes in groups_to_classes.items() if len(indexes) > 1]
    if mixed_groups:
        raise ValueError(
            "A capture group cannot span multiple classes. Invalid groups: "
            + ", ".join(sorted(mixed_groups)[:10])
        )

    return records, warnings


def assign_splits(
    records: list[ImageRecord],
    classes: list[ClassDefinition],
    config: TrainingConfig,
) -> list[ImageRecord]:
    records_by_class: dict[int, list[ImageRecord]] = defaultdict(list)
    for record in records:
        records_by_class[record.class_index].append(record)

    split_by_group: dict[str, str] = {}
    for class_definition in classes:
        class_records = records_by_class[class_definition.index]
        groups = sorted({record.group_id for record in class_records})
        if len(groups) < 3:
            raise ValueError(
                f"{class_definition.diagnosis_id} needs at least three independent capture groups; "
                f"found {len(groups)}."
            )

        random.Random(f"{config.seed}:{class_definition.diagnosis_id}").shuffle(groups)
        test_count = max(1, round(len(groups) * config.test_fraction))
        validation_count = max(1, round(len(groups) * config.validation_fraction))
        while test_count + validation_count >= len(groups):
            if test_count >= validation_count and test_count > 1:
                test_count -= 1
            elif validation_count > 1:
                validation_count -= 1
            else:
                break

        for group in groups[:test_count]:
            split_by_group[group] = "test"
        for group in groups[test_count : test_count + validation_count]:
            split_by_group[group] = "validation"
        for group in groups[test_count + validation_count :]:
            split_by_group[group] = "train"

    split_records = [
        ImageRecord(**{**asdict(record), "split": split_by_group[record.group_id]})
        for record in records
    ]
    for class_definition in classes:
        class_splits = {
            record.split for record in split_records if record.class_index == class_definition.index
        }
        if class_splits != {"train", "validation", "test"}:
            raise ValueError(
                f"{class_definition.diagnosis_id} did not receive all three splits: {class_splits}."
            )
    return split_records


def validate_decodable_images(records: list[ImageRecord]) -> None:
    import tensorflow as tf

    invalid_images: list[str] = []
    for record in records:
        path = PROJECT_ROOT / record.relative_path
        try:
            image = tf.io.decode_image(
                tf.io.read_file(path),
                channels=3,
                expand_animations=False,
            )
            shape = image.shape
            if image.shape.rank != 3 or shape[-1] != 3 or shape[0] == 0 or shape[1] == 0:
                invalid_images.append(record.relative_path)
        except (tf.errors.InvalidArgumentError, ValueError):
            invalid_images.append(record.relative_path)

    if invalid_images:
        raise ValueError(
            "Unreadable or invalid images detected: " + ", ".join(invalid_images[:20])
        )


def write_manifests(
    records: list[ImageRecord],
    warnings: list[str],
    output_directory: Path = PROJECT_ROOT / "manifests",
) -> dict[str, object]:
    output_directory.mkdir(parents=True, exist_ok=True)
    fields = ["relative_path", "class_index", "diagnosis_id", "crop", "group_id"]

    split_counts: dict[str, Counter[str]] = {}
    for split in ("train", "validation", "test"):
        split_records = sorted(
            (record for record in records if record.split == split),
            key=lambda record: (record.class_index, record.relative_path),
        )
        with (output_directory / f"{split}.csv").open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=fields)
            writer.writeheader()
            for record in split_records:
                writer.writerow({field: getattr(record, field) for field in fields})
        split_counts[split] = Counter(record.diagnosis_id for record in split_records)

    summary: dict[str, object] = {
        "total_images": len(records),
        "warnings": warnings,
        "splits": {
            split: {
                "total": sum(counts.values()),
                "by_class": dict(sorted(counts.items())),
            }
            for split, counts in split_counts.items()
        },
    }
    (output_directory / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary
