from __future__ import annotations

import csv
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from training.contract import PROJECT_ROOT, load_classes, load_config, validate_mobile_labels
from training.manifest import assign_splits, discover_images, write_manifests


class TrainingContractTests(unittest.TestCase):
    def test_class_contract_matches_mobile_labels(self) -> None:
        classes = load_classes()
        validate_mobile_labels(classes)

        self.assertEqual(len(classes), 15)
        for crop in ("maize", "cassava", "rice"):
            crop_classes = [item for item in classes if item.crop == crop]
            self.assertEqual(len(crop_classes), 5)
            self.assertIn(f"{crop}_unknown", {item.diagnosis_id for item in crop_classes})

    def test_manifest_builder_creates_all_splits_without_group_leakage(self) -> None:
        classes = load_classes()
        config = replace(load_config(), minimum_images_per_class=3)

        with tempfile.TemporaryDirectory(prefix="manifest-test-", dir=PROJECT_ROOT) as temporary:
            temporary_root = Path(temporary)
            dataset_root = temporary_root / "datasets" / "raw"
            group_rows: list[dict[str, str]] = []
            for class_definition in classes:
                class_directory = dataset_root / class_definition.diagnosis_id
                class_directory.mkdir(parents=True)
                for image_index in range(6):
                    image_path = class_directory / f"image-{image_index}.jpg"
                    image_path.write_bytes(
                        f"{class_definition.diagnosis_id}:{image_index}".encode("utf-8")
                    )
                    group_rows.append(
                        {
                            "relative_path": image_path.relative_to(PROJECT_ROOT).as_posix(),
                            "group_id": f"{class_definition.diagnosis_id}-group-{image_index // 2}",
                        }
                    )

            groups_path = temporary_root / "datasets" / "groups.csv"
            with groups_path.open("w", newline="", encoding="utf-8") as target:
                writer = csv.DictWriter(target, fieldnames=["relative_path", "group_id"])
                writer.writeheader()
                writer.writerows(group_rows)

            records, warnings = discover_images(
                classes,
                config,
                dataset_root=dataset_root,
                groups_path=groups_path,
            )
            split_records = assign_splits(records, classes, config)
            summary = write_manifests(
                split_records,
                warnings,
                output_directory=temporary_root / "manifests",
            )

            self.assertEqual(summary["total_images"], 90)
            self.assertEqual(warnings, [])
            groups_to_splits: dict[str, set[str]] = {}
            for record in split_records:
                groups_to_splits.setdefault(record.group_id, set()).add(record.split)
            self.assertTrue(all(len(splits) == 1 for splits in groups_to_splits.values()))
            self.assertEqual({record.split for record in split_records}, {"train", "validation", "test"})


if __name__ == "__main__":
    unittest.main()
