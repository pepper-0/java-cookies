# Model handoff slot

No model is bundled yet. The future MobileNetV3 classifier has 15 outputs in the exact order defined by `../labels.json` and `mobilenetv3-training/classes.json`.

The output contract contains:

- `diagnosis_id`: the selected crop-specific class ID;
- `crop`: `maize`, `cassava`, or `rice`, derived from the class metadata; and
- `confidence`: the selected class probability from 0 through 1.

Severity is not part of the classifier, observation storage, or backend contract.

Before integration, also provide:

- a `.tflite` or `.onnx` model file;
- input dimensions;
- RGB or BGR channel ordering;
- resize, crop, scaling, and normalization steps;
- output tensor meaning; and
- a recommended confidence threshold.

Implement the runtime behind `src/ml/classifier.ts`. The screens, local database, and sync service must continue to consume the existing `DiagnosisResult` contract.

## Local guidance

`../guidance.json` contains offline sample guidance keyed by `diagnosis_id`. Each entry provides a title, summary, recommended actions, monitoring guidance, escalation guidance, and disclaimer. `../guidance.ts` performs the lookup and returns a safe fallback for an unrecognized future ID.

The guidance file is application content, not a model output. Its sample wording must be reviewed by appropriate local agricultural experts before production use.
