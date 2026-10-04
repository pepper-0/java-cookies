# MobileNetV3-Large mobile handoff

LimaDRC has a trained PyTorch MobileNetV3-Large classifier and a converted
float32 TFLite model:

- `weights/mobilenetv3_crop_diseases.pth`
- `weights/mobilenetv3_crop_diseases.float32.tflite`

The mobile app still uses `src/ml/mockClassifier.ts`. This document defines the
contract that the on-device classifier must follow when the TFLite runtime is
added.

## Trained output order

The model has exactly ten logits in the ImageFolder order captured during
training. The order must not be changed after conversion:

| Output | Trained class |
| ---: | --- |
| 0 | `cassava_bacterial_blight` |
| 1 | `cassava_brown_streak_disease` |
| 2 | `cassava_healthy` |
| 3 | `cassava_mosaic_disease` |
| 4 | `maize_common_rust` |
| 5 | `maize_healthy` |
| 6 | `maize_northern_leaf_blight` |
| 7 | `maize_streak_disease` |
| 8 | `rice_blast` |
| 9 | `rice_healthy` |

Cassava and maize each have their complete four-class set and are the fully
supported demonstration crops. Rice is only partially represented: the model
has `rice_blast` and `rice_healthy`, but not `rice_bacterial_leaf_blight` or
`rice_yellow_mottle_disease`.

`src/ml/labels.json` preserves all ten real outputs. `cassava_unknown`,
`maize_unknown`, and `rice_unknown` are application fallbacks for
low-confidence or unsupported results; they are not extra model logits.

## TFLite tensor contract

- input name: `input_1`;
- input type and shape: float32 NHWC `[1, 224, 224, 3]`;
- color order: RGB;
- preprocessing: resize to 224×224, scale channel bytes to 0-1, then normalize
  with mean `[0.485, 0.456, 0.406]` and standard deviation
  `[0.229, 0.224, 0.225]`;
- output name: `output_1`;
- output type and shape: float32 logits `[1, 10]`;
- postprocessing: apply softmax, select the highest probability, and resolve
  its numeric index through `src/ml/labels.json`;
- fallback: after selecting or deriving the crop, return its crop-specific
  unknown diagnosis when confidence is below the threshold selected during
  validation or when that crop is not fully supported.

The source PyTorch model accepts NCHW `[1, 3, 224, 224]`. The converted TFLite
file exposes NHWC, so the mobile implementation must follow the TFLite shape.

## Integration checklist

1. Copy `weights/mobilenetv3_crop_diseases.float32.tflite` to
   `mobile/assets/models/`.
2. Add `tflite` to Metro's `resolver.assetExts`.
3. Install an Expo-compatible React Native TFLite runtime and its native
   dependencies.
4. Implement RGB image decoding, resizing, normalization, inference, softmax,
   and label lookup behind `src/ml/classifier.ts`.
5. Keep the screens and storage layer dependent only on `ImageClassifier` and
   `DiagnosisResult`.
6. Build a custom Expo development client; native TFLite libraries do not run
   in Expo Go.
7. Test all four cassava classes, all four maize classes, and low-confidence or
   unsupported-crop fallback cases on the target Android emulator or device.

## Offline guidance

`guidance.en.json` and `guidance.fr.json` contain the full 15-record crop
guidance catalog. The ten real model outputs and all three crop-specific unknown
fallbacks have guidance entries. Keeping the two currently untrained rice
disease entries is intentional and allows a later model version to use them
without changing the guidance schema.

The guidance is prototype content. Agricultural guidance, treatment details,
and estimated costs require review by appropriate DRC agricultural experts
before production use.
