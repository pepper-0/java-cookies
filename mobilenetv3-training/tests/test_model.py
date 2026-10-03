from __future__ import annotations

import importlib.util
import unittest

from training.contract import load_classes, load_config
from training.model import build_model


@unittest.skipUnless(importlib.util.find_spec("tensorflow"), "TensorFlow is not installed")
class ModelTests(unittest.TestCase):
    def test_mobilenetv3_small_shapes(self) -> None:
        classes = load_classes()
        config = load_config()
        model, backbone = build_model(config, len(classes), weights=None)

        self.assertEqual(model.input_shape, (None, 224, 224, 3))
        self.assertEqual(model.output_shape, (None, 15))
        self.assertFalse(backbone.trainable)


if __name__ == "__main__":
    unittest.main()
