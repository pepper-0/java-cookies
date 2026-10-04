# MobileNetV3-Large handoff

The trained checkpoint is `weights/mobilenetv3_crop_diseases.pth`. It is a
PyTorch MobileNetV3-Large state dictionary with a 10-logit classification head.

## Exact trained output order

The order below comes from `full_dataset.classes` in the completed training run.
It must not be reordered after conversion:

1. `cassava_bacterial_blight`
2. `cassava_brown_streak_disease`
3. `cassava_healthy`
4. `cassava_mosaic_disease`
5. `maize_common_rust`
6. `maize_healthy`
7. `maize_northern_leaf_blight`
8. `maize_streak_disease`
9. `rice_blast`
10. `rice_healthy`

For the cassava-only demonstration, `src/ml/labels.json` maps logits 0-3 to
their real cassava diagnosis IDs and logits 4-9 to `cassava_unknown`. Do not
change the model head or append fake logits after training.

## Tensor contract

- input: one RGB image, float32, NCHW shape `[1, 3, 224, 224]`;
- preprocessing: resize to 224×224, scale bytes to 0-1, then normalize with
  mean `[0.485, 0.456, 0.406]` and standard deviation
  `[0.229, 0.224, 0.225]`;
- output: float32 logits with shape `[1, 10]`;
- postprocessing: apply softmax, choose the highest probability, and use the
  matching numeric key from `src/ml/labels.json`;
- fallback: return `cassava_unknown` when the winning index is 4-9 or when the
  winning cassava probability is below the demonstration confidence threshold.

## Export to TFLite

Google's LiteRT Torch converter runs on Linux. Open `java_cookies.ipynb` in
Google Colab and run its final `export-tflite` cell after the trained `model`
variable exists. The cell installs `litert-torch==0.9.4`, converts the model,
checks TFLite logits against PyTorch logits, confirms a `[1, 10]` output, and
downloads `mobilenetv3_crop_diseases.tflite`.

Do not integrate a file that fails the numerical comparison.

## Mobile packaging

After export:

1. Put the file at
   `mobile/assets/models/mobilenetv3_crop_diseases.tflite`.
2. Add `tflite` to Metro's `resolver.assetExts`.
3. Install a LiteRT React Native runtime and its native dependencies.
4. Implement image decoding and the tensor preprocessing contract above behind
   `src/ml/classifier.ts`.
5. Use a custom Expo development build. A TFLite native runtime cannot run in
   Expo Go.

The screens and storage layer should continue to depend only on
`ImageClassifier` and `DiagnosisResult`, never directly on the LiteRT runtime.
