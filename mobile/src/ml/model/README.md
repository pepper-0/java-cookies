# Model handoff slot

No model is bundled at Checkpoint 1. Before integration, provide:

- a `.tflite` or `.onnx` model file;
- exact class ordering and labels;
- input dimensions;
- RGB or BGR channel ordering;
- resize, crop, scaling, and normalization steps;
- output tensor meaning; and
- a recommended confidence threshold.

Implement the runtime behind `src/ml/classifier.ts`. The screens, local database, and sync service must continue to consume the existing `DiagnosisResult` contract.
