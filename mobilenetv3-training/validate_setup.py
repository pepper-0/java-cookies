from __future__ import annotations

import argparse
import importlib.util
import sys

from training.contract import load_classes, load_config, validate_mobile_labels


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the MobileNetV3Small training scaffold.")
    parser.add_argument(
        "--contract-only",
        action="store_true",
        help="Validate files without requiring the supported Python version or TensorFlow.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    classes = load_classes()
    config = load_config()
    validate_mobile_labels(classes)
    print(f"Class contract: {len(classes)} ordered classes")
    print(f"Model input: {config.image_height}x{config.image_width} RGB")

    if args.contract_only:
        print("Contract-only validation passed.")
        return

    if not (sys.version_info.major == 3 and 9 <= sys.version_info.minor <= 12):
        raise RuntimeError(
            "TensorFlow 2.16 supports Python 3.9 through 3.12. "
            f"Current interpreter: {sys.version.split()[0]}. Use Python 3.12 as specified in .python-version."
        )
    if importlib.util.find_spec("tensorflow") is None:
        raise RuntimeError("TensorFlow is not installed. Run: python -m pip install -r requirements.txt")

    import tensorflow as tf

    from training.model import build_model

    if tf.__version__ != "2.16.2":
        raise RuntimeError(f"Expected TensorFlow 2.16.2; found {tf.__version__}.")
    model, backbone = build_model(config, len(classes), weights=None)
    if model.input_shape != (None, config.image_height, config.image_width, 3):
        raise RuntimeError(f"Unexpected model input shape: {model.input_shape}")
    if model.output_shape != (None, len(classes)):
        raise RuntimeError(f"Unexpected model output shape: {model.output_shape}")
    if backbone.trainable:
        raise RuntimeError("The MobileNetV3Small backbone should start frozen.")
    print(f"TensorFlow environment: {tf.__version__}")
    print(f"Model parameters: {model.count_params():,}")
    print("Training setup validation passed.")


if __name__ == "__main__":
    main()
