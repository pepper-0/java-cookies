# LimaDRC MobileNetV3Small Training

This directory contains a complete TensorFlow/Keras transfer-learning pipeline for a 15-class MobileNetV3Small image classifier. It is ready for image datasets but does not contain training data or a trained model.

## Runtime

Use Python 3.12. The repository host currently defaults to Python 3.14, which is outside the supported range for the pinned TensorFlow runtime; the project standardizes on 3.12 even if another compatible interpreter is installed.

```bash
cd mobilenetv3-training
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python validate_setup.py
```

The model uses TensorFlow 2.16.2, 224×224 RGB input, ImageNet initialization, and MobileNetV3's embedded input preprocessing. Model inputs therefore remain float pixel values in the `[0, 255]` range.

## Output contract

The classifier produces 15 softmax probabilities. Class order is fixed by `classes.json` and must remain identical in the mobile `labels.json` file.

| Index | Crop | Display name | Diagnosis ID |
| ---: | --- | --- | --- |
| 0 | Maize | Healthy | `maize_healthy` |
| 1 | Maize | Maize Streak Disease | `maize_streak_disease` |
| 2 | Maize | Northern Leaf Blight | `maize_northern_leaf_blight` |
| 3 | Maize | Common Rust | `maize_common_rust` |
| 4 | Maize | Unknown | `maize_unknown` |
| 5 | Cassava | Healthy | `cassava_healthy` |
| 6 | Cassava | Cassava Brown Streak Disease | `cassava_brown_streak_disease` |
| 7 | Cassava | Cassava Bacterial Blight | `cassava_bacterial_blight` |
| 8 | Cassava | Cassava Mosaic Disease | `cassava_mosaic_disease` |
| 9 | Cassava | Unknown | `cassava_unknown` |
| 10 | Rice | Healthy | `rice_healthy` |
| 11 | Rice | Bacterial Leaf Blight | `rice_bacterial_leaf_blight` |
| 12 | Rice | Rice Blast | `rice_blast` |
| 13 | Rice | Rice Yellow Mottle Disease | `rice_yellow_mottle_disease` |
| 14 | Rice | Unknown | `rice_unknown` |

Severity is not a model output.

## Add the dataset

Place JPEG or PNG images in one directory per diagnosis ID:

```text
datasets/raw/
  maize_healthy/
  maize_streak_disease/
  maize_northern_leaf_blight/
  maize_common_rust/
  maize_unknown/
  cassava_healthy/
  cassava_brown_streak_disease/
  cassava_bacterial_blight/
  cassava_mosaic_disease/
  cassava_unknown/
  rice_healthy/
  rice_bacterial_leaf_blight/
  rice_blast/
  rice_yellow_mottle_disease/
  rice_unknown/
```

The three Unknown classes must contain images of the named crop that do not reliably fit its supported healthy or disease classes. A low-confidence rejection threshold is separate from these learned classes and must be calibrated after evaluation.

### Capture groups

Images of the same plant or capture session must stay in the same data split. Copy `groups.example.csv` to `datasets/groups.csv`, then map each image path to a stable plant/session group:

```csv
relative_path,group_id
datasets/raw/cassava_healthy/image-001.jpg,farm-12-plant-7-session-1
datasets/raw/cassava_healthy/image-002.jpg,farm-12-plant-7-session-1
```

If this file is omitted, preparation treats every image as independent and emits a warning. That fallback is suitable for pipeline testing, not final model evaluation.

## Prepare, train, evaluate, and export

Run these commands from `mobilenetv3-training` with the Python 3.12 virtual environment active:

```bash
python prepare_dataset.py
python train.py
python evaluate.py
python export_tflite.py
```

- `prepare_dataset.py` checks all classes, minimum image counts, unreadable images, byte-identical duplicates, group validity, and deterministic stratified train/validation/test manifests.
- `train.py` trains a class-weighted classifier head, then fine-tunes the last MobileNetV3Small layers at a lower learning rate while keeping batch-normalization layers frozen. It selects the checkpoint with the lower validation loss.
- `evaluate.py` records held-out loss, accuracy, top-three accuracy, per-class precision/recall/F1, and a confusion matrix.
- `export_tflite.py` exports float32 and float16 TFLite models, verifies their input/output shapes and a test inference, and packages matching labels and preprocessing metadata.

Configuration is stored in `config.json`. Generated artifacts are written to ignored directories:

- `manifests/`: deterministic split CSV files and counts;
- `checkpoints/`: Keras checkpoints and training metadata;
- `runs/`: training histories and evaluation reports; and
- `exports/`: verified TFLite models, labels, classes, and deployment metadata.

The configured minimum of ten images per class only protects the mechanics of splitting. It is not a claim that ten images are sufficient for a reliable field model; final collection should target substantially larger, diverse, and independently captured class samples.

## Validation without TensorFlow or datasets

The contract and pure-Python dataset logic can be checked before installing TensorFlow or receiving images:

```bash
python validate_setup.py --contract-only
python -m unittest discover -s tests -v
python -m compileall -q .
```

Datasets, manifests, checkpoints, training runs, virtual environments, and exported model binaries are excluded from Git.
