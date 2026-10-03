from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from training.contract import PROJECT_ROOT, TrainingConfig


def read_manifest(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise ValueError(f"Manifest does not exist: {path}. Run prepare_dataset.py first.")
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    required_fields = {"relative_path", "class_index", "diagnosis_id", "crop", "group_id"}
    if not rows:
        raise ValueError(f"Manifest is empty: {path}")
    if set(rows[0]) != required_fields:
        raise ValueError(f"Unexpected columns in {path}; expected {sorted(required_fields)}.")
    return rows


def class_weights(rows: list[dict[str, str]], number_of_classes: int) -> dict[int, float]:
    counts = Counter(int(row["class_index"]) for row in rows)
    missing = sorted(set(range(number_of_classes)) - set(counts))
    if missing:
        raise ValueError(f"Training manifest is missing class indexes: {missing}")
    total = sum(counts.values())
    return {
        class_index: total / (number_of_classes * count)
        for class_index, count in sorted(counts.items())
    }


def create_dataset(
    manifest_path: Path,
    config: TrainingConfig,
    *,
    training: bool,
):
    import tensorflow as tf

    rows = read_manifest(manifest_path)
    image_paths = [str(PROJECT_ROOT / row["relative_path"]) for row in rows]
    labels = [int(row["class_index"]) for row in rows]

    dataset = tf.data.Dataset.from_tensor_slices((image_paths, labels))
    if training:
        dataset = dataset.shuffle(
            buffer_size=len(rows),
            seed=config.seed,
            reshuffle_each_iteration=True,
        )

    def load_image(path, label):
        encoded = tf.io.read_file(path)
        image = tf.io.decode_image(encoded, channels=3, expand_animations=False)
        image.set_shape([None, None, 3])
        image = tf.image.resize(image, config.image_size, antialias=True)
        return tf.cast(image, tf.float32), label

    dataset = dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    dataset = dataset.batch(config.batch_size)

    if training:
        augmentation = tf.keras.Sequential(
            [
                tf.keras.layers.RandomFlip("horizontal", seed=config.seed),
                tf.keras.layers.RandomRotation(0.08, fill_mode="reflect", seed=config.seed + 1),
                tf.keras.layers.RandomZoom(0.1, fill_mode="reflect", seed=config.seed + 2),
                tf.keras.layers.RandomContrast(0.1, seed=config.seed + 3),
            ],
            name="training_augmentation",
        )

        def augment(images, batch_labels):
            return augmentation(images, training=True), batch_labels

        dataset = dataset.map(augment, num_parallel_calls=tf.data.AUTOTUNE)

    return dataset.prefetch(tf.data.AUTOTUNE), rows
