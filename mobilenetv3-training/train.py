from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from training.contract import PROJECT_ROOT, load_classes, load_config, validate_mobile_labels
from training.data import class_weights, create_dataset, read_manifest
from training.model import build_model, compile_model, enable_fine_tuning, get_backbone


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train the LimaDRC MobileNetV3Small classifier in two stages."
    )
    parser.add_argument(
        "--skip-fine-tuning",
        action="store_true",
        help="Train only the new classification head.",
    )
    return parser.parse_args()


def configure_tensorflow(seed: int) -> None:
    import tensorflow as tf

    tf.keras.utils.set_random_seed(seed)
    try:
        tf.config.experimental.enable_op_determinism()
    except (AttributeError, RuntimeError):
        pass


def callbacks(checkpoint_path: Path, log_path: Path, patience: int):
    import tensorflow as tf

    return [
        tf.keras.callbacks.ModelCheckpoint(
            str(checkpoint_path),
            monitor="val_loss",
            save_best_only=True,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=patience,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.25,
            patience=max(2, patience // 2),
            min_lr=1e-7,
        ),
        tf.keras.callbacks.CSVLogger(str(log_path)),
        tf.keras.callbacks.TerminateOnNaN(),
    ]


def evaluate_loss(model_path: Path, validation_dataset) -> float:
    import tensorflow as tf

    model = tf.keras.models.load_model(str(model_path))
    result = model.evaluate(validation_dataset, verbose=0, return_dict=True)
    return float(result["loss"])


def main() -> None:
    args = parse_args()
    import tensorflow as tf

    classes = load_classes()
    config = load_config()
    validate_mobile_labels(classes)
    configure_tensorflow(config.seed)

    manifest_directory = PROJECT_ROOT / "manifests"
    train_manifest = manifest_directory / "train.csv"
    train_rows = read_manifest(train_manifest)
    train_dataset, _ = create_dataset(train_manifest, config, training=True)
    validation_dataset, _ = create_dataset(
        manifest_directory / "validation.csv", config, training=False
    )
    weights = class_weights(train_rows, len(classes))

    checkpoints = PROJECT_ROOT / "checkpoints"
    logs = PROJECT_ROOT / "runs"
    checkpoints.mkdir(parents=True, exist_ok=True)
    logs.mkdir(parents=True, exist_ok=True)
    head_checkpoint = checkpoints / "best_head.keras"
    fine_tuned_checkpoint = checkpoints / "best_fine_tuned.keras"
    final_checkpoint = checkpoints / "best_model.keras"

    model, _ = build_model(config, len(classes))
    compile_model(model, config.head_learning_rate)
    model.fit(
        train_dataset,
        validation_data=validation_dataset,
        epochs=config.head_epochs,
        class_weight=weights,
        callbacks=callbacks(
            head_checkpoint,
            logs / "head_history.csv",
            config.early_stopping_patience,
        ),
    )

    candidates = [head_checkpoint]
    if not args.skip_fine_tuning:
        model = tf.keras.models.load_model(str(head_checkpoint))
        enable_fine_tuning(get_backbone(model), config.fine_tune_layers)
        compile_model(model, config.fine_tune_learning_rate)
        model.fit(
            train_dataset,
            validation_data=validation_dataset,
            epochs=config.fine_tune_epochs,
            class_weight=weights,
            callbacks=callbacks(
                fine_tuned_checkpoint,
                logs / "fine_tune_history.csv",
                config.early_stopping_patience,
            ),
        )
        candidates.append(fine_tuned_checkpoint)

    losses = {str(path): evaluate_loss(path, validation_dataset) for path in candidates}
    selected_checkpoint = min(candidates, key=lambda path: losses[str(path)])
    shutil.copy2(selected_checkpoint, final_checkpoint)
    metadata = {
        "model": "MobileNetV3Small",
        "number_of_classes": len(classes),
        "selected_checkpoint": selected_checkpoint.name,
        "validation_losses": losses,
        "class_weights": {str(key): value for key, value in weights.items()},
        "tensorflow_version": tf.__version__,
        "config": config.__dict__,
    }
    (checkpoints / "training_metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Selected {selected_checkpoint.name}; final model: {final_checkpoint}")


if __name__ == "__main__":
    main()
