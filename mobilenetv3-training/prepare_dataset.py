from __future__ import annotations

import argparse
import json
from pathlib import Path

from training.contract import PROJECT_ROOT, load_classes, load_config, validate_mobile_labels
from training.manifest import (
    assign_splits,
    discover_images,
    validate_decodable_images,
    write_manifests,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate LimaDRC images and create deterministic grouped data manifests."
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=PROJECT_ROOT / "datasets" / "raw",
        help="Directory containing one subdirectory per diagnosis_id.",
    )
    parser.add_argument(
        "--groups",
        type=Path,
        default=PROJECT_ROOT / "datasets" / "groups.csv",
        help="Optional CSV mapping relative_path to capture group_id.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "manifests",
        help="Directory for train, validation, and test CSV files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    classes = load_classes()
    config = load_config()
    validate_mobile_labels(classes)
    records, warnings = discover_images(classes, config, args.dataset_root, args.groups)
    validate_decodable_images(records)
    split_records = assign_splits(records, classes, config)
    summary = write_manifests(split_records, warnings, args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
