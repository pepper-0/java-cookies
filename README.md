# LimaDRC

LimaDRC is an offline-first Android agriculture prototype for smallholder
farmers in the Democratic Republic of the Congo. It combines crop-disease
screening, local field guidance, farmer and farm records, synchronization, and
demonstration market prices in an English/French Expo application.

The application is designed to keep working when connectivity is unreliable.
Profiles and diagnosis metadata are stored in SQLite on the device and remain
`PENDING` until the local FastAPI service confirms synchronization. Crop photos
are used transiently by the diagnosis flow and are not stored in observation
records or sent by the synchronization API.

## Current status

Implemented:

- Expo SDK 57 / React Native Android application using Expo Router;
- first-run farm setup and onboarding;
- English and French interface localization;
- camera and gallery image selection with a diagnosis-result preview;
- an isolated asynchronous classifier interface with a mock implementation;
- English and French offline disease guidance keyed by `diagnosis_id`;
- local SQLite farmer, farm, observation, settings, and sync state;
- FastAPI synchronization endpoints backed by SQLite;
- static, clearly labeled demonstration market prices; and
- a trained 10-output MobileNetV3-Large model in PyTorch and TFLite formats.

Not yet implemented:

- on-device TFLite execution—the mobile app still uses the mock classifier;
- a calibrated production confidence threshold;
- live market-price, registry, mapping, notification, or speech services; and
- production review of agricultural guidance and French terminology.

## Repository layout

| Path | Purpose |
| --- | --- |
| `mobile/` | Expo/React Native application |
| `backend/` | Local synchronization API and its tests |
| `app/` | Optional PyTorch/FastAPI image-inference service |
| `weights/` | Trained `.pth` and converted `.tflite` files |
| `java_cookies.ipynb` | Training and TFLite conversion notebook |
| `mobile/src/ml/` | Classifier contract, label mapping, and offline guidance |

The synchronization API in `backend/` and the optional model API in `app/` are
separate services. The planned mobile integration will run the TFLite model on
the Android device rather than upload crop photos to either service.

## Model contract

The trained MobileNetV3-Large model emits ten logits in this fixed order:

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
supported demonstration crops. Rice is only partially covered: the checkpoint
does not contain `rice_bacterial_leaf_blight` or
`rice_yellow_mottle_disease`. Crop-specific unknown results are application
fallbacks for low-confidence or unsupported results, not trained logits.

The TFLite file accepts one RGB float32 image in NHWC shape
`[1, 224, 224, 3]`. Pixel values must be scaled to 0-1 and normalized with
ImageNet mean `[0.485, 0.456, 0.406]` and standard deviation
`[0.229, 0.224, 0.225]`. It returns float32 logits with shape `[1, 10]`.
See `mobile/src/ml/model/README.md` for the complete mobile handoff contract.

## Requirements

- Node.js 22.13 or newer
- Android Studio with an Android emulator
- Python 3.11 or newer for the synchronization backend

## Start the synchronization backend

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

These commands enter the backend directory, create and activate an isolated
Python environment, install the pinned dependencies, and start the development
server. Keep the process running while testing synchronization. Press
`Control-C` to stop it.

The Android emulator reaches the host computer at `http://10.0.2.2:8000`, which
is the app's default backend address. A physical device must use the development
computer's LAN address instead.

## Start the Android application

Open a second terminal at the repository root:

```bash
cd mobile
npm install
npm run android
```

`npm install` installs the versions recorded in `mobile/package-lock.json`.
`npm run android` starts Metro and attempts to open LimaDRC in a connected
Android emulator.

## Validate the project

Run the mobile checks from `mobile/`:

```bash
npm run validate:guidance
npm run typecheck
npm run lint
npm run doctor
```

Run the backend tests from `backend/` with its virtual environment activated:

```bash
python -m pytest -q
```

## Next model-integration step

Before replacing the mock classifier, copy the TFLite file into the mobile
assets, configure Metro to bundle `.tflite`, install a compatible native
runtime, implement the documented preprocessing and postprocessing contract,
and create a custom Expo development build. Native TFLite modules cannot run in
Expo Go.

## Prototype limitations

Diagnosis and agricultural guidance are demonstration features and are not a
substitute for confirmation by a qualified agricultural extension professional.
Market prices are invented static values and must not be used for real buying or
selling decisions.
