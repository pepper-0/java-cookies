from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from training.contract import PROJECT_ROOT, REPOSITORY_ROOT, load_classes, load_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export and verify float32 and float16 LimaDRC TFLite models."
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=PROJECT_ROOT / "checkpoints" / "best_model.keras",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "exports",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_tflite(path: Path, number_of_classes: int, image_size: tuple[int, int]) -> dict[str, object]:
    import numpy as np
    import tensorflow as tf

    interpreter = tf.lite.Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    expected_input_shape = [1, image_size[0], image_size[1], 3]
    if input_details["shape"].tolist() != expected_input_shape:
        raise ValueError(
            f"Unexpected TFLite input shape for {path}: {input_details['shape'].tolist()}"
        )
    if output_details["shape"].tolist() != [1, number_of_classes]:
        raise ValueError(
            f"Unexpected TFLite output shape for {path}: {output_details['shape'].tolist()}"
        )

    test_input = np.zeros(expected_input_shape, dtype=input_details["dtype"])
    interpreter.set_tensor(input_details["index"], test_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"])
    if not np.isfinite(output).all():
        raise ValueError(f"Non-finite output detected in {path}.")
    if not np.allclose(output.sum(axis=1), 1.0, atol=1e-4):
        raise ValueError(f"TFLite output from {path} is not a probability distribution.")

    return {
        "file": path.name,
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "input_shape": input_details["shape"].tolist(),
        "input_dtype": input_details["dtype"].__name__,
        "output_shape": output_details["shape"].tolist(),
        "output_dtype": output_details["dtype"].__name__,
    }


def main() -> None:
    args = parse_args()
    import tensorflow as tf

    classes = load_classes()
    config = load_config()
    if not args.model.exists():
        raise ValueError(f"Model does not exist: {args.model}. Run train.py first.")

    model = tf.keras.models.load_model(str(args.model))
    args.output.mkdir(parents=True, exist_ok=True)

    float32_converter = tf.lite.TFLiteConverter.from_keras_model(model)
    float32_path = args.output / "limadrc_mobilenetv3_small_float32.tflite"
    float32_path.write_bytes(float32_converter.convert())

    float16_converter = tf.lite.TFLiteConverter.from_keras_model(model)
    float16_converter.optimizations = [tf.lite.Optimize.DEFAULT]
    float16_converter.target_spec.supported_types = [tf.float16]
    float16_path = args.output / "limadrc_mobilenetv3_small_float16.tflite"
    float16_path.write_bytes(float16_converter.convert())

    labels_source = REPOSITORY_ROOT / "mobile" / "src" / "ml" / "labels.json"
    shutil.copy2(labels_source, args.output / "labels.json")
    shutil.copy2(PROJECT_ROOT / "classes.json", args.output / "classes.json")

    artifacts = [
        verify_tflite(float32_path, len(classes), config.image_size),
        verify_tflite(float16_path, len(classes), config.image_size),
    ]
    metadata = {
        "model": "MobileNetV3Small",
        "input": {
            "shape": [1, config.image_height, config.image_width, 3],
            "dtype": "float32",
            "color_order": "RGB",
            "value_range": [0, 255],
            "resize": "bilinear",
            "preprocessing": "Embedded MobileNetV3 rescaling from [0, 255] to [-1, 1]",
        },
        "output": {
            "shape": [1, len(classes)],
            "dtype": "float32",
            "meaning": "Softmax probability in classes.json index order",
        },
        "artifacts": artifacts,
        "tensorflow_version": tf.__version__,
    }
    (args.output / "metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
