from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from training.contract import PROJECT_ROOT, load_classes, load_config, validate_mobile_labels
from training.data import create_dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate a trained LimaDRC model on the held-out test manifest."
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=PROJECT_ROOT / "checkpoints" / "best_model.keras",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    import numpy as np
    import tensorflow as tf

    classes = load_classes()
    config = load_config()
    validate_mobile_labels(classes)
    if not args.model.exists():
        raise ValueError(f"Model does not exist: {args.model}. Run train.py first.")

    test_dataset, test_rows = create_dataset(
        PROJECT_ROOT / "manifests" / "test.csv",
        config,
        training=False,
    )
    model = tf.keras.models.load_model(str(args.model))
    evaluation = {
        key: float(value)
        for key, value in model.evaluate(test_dataset, verbose=1, return_dict=True).items()
    }
    probabilities = model.predict(test_dataset, verbose=1)
    predictions = np.argmax(probabilities, axis=1)
    labels = np.asarray([int(row["class_index"]) for row in test_rows], dtype=np.int64)

    confusion = np.zeros((len(classes), len(classes)), dtype=np.int64)
    for expected, predicted in zip(labels, predictions):
        confusion[expected, predicted] += 1

    report: dict[str, object] = {"overall": evaluation, "classes": {}}
    class_report: dict[str, object] = {}
    for class_definition in classes:
        index = class_definition.index
        true_positive = int(confusion[index, index])
        false_positive = int(confusion[:, index].sum() - true_positive)
        false_negative = int(confusion[index, :].sum() - true_positive)
        support = int(confusion[index, :].sum())
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        class_report[class_definition.diagnosis_id] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }
    report["classes"] = class_report

    output_directory = PROJECT_ROOT / "runs" / "evaluation"
    output_directory.mkdir(parents=True, exist_ok=True)
    (output_directory / "metrics.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    with (output_directory / "confusion_matrix.csv").open(
        "w", newline="", encoding="utf-8"
    ) as target:
        writer = csv.writer(target)
        writer.writerow(["expected\\predicted", *[item.diagnosis_id for item in classes]])
        for class_definition, row in zip(classes, confusion.tolist()):
            writer.writerow([class_definition.diagnosis_id, *row])

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
