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

`../guidance.json` contains offline diagnosis data keyed by `diagnosis_id`. Every known diagnosis, crop-specific unknown result, template, and fallback uses the same record schema: ID, name, disease type, symptoms, diagnosis message, structured treatments, and voice message. Treatments can also provide category, cost, and local-verification metadata. `../guidance.ts` performs the lookup and returns the same-schema fallback for an unrecognized future ID.

The guidance file is application content, not a model output. Its agricultural guidance, treatment details, and estimated costs must be reviewed and localized by appropriate DRC agricultural experts before production use.
