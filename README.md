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
- camera, photo-library, and file-browser image selection with a diagnosis-result preview;
- on-device MobileNetV3-Large inference behind an isolated classifier interface;
- English and French offline disease guidance keyed by `diagnosis_id`;
- local SQLite farmer, farm, observation, settings, and sync state;
- FastAPI synchronization endpoints backed by SQLite;
- static, clearly labeled demonstration market prices; and
- a trained 10-output MobileNetV3-Large model in PyTorch and TFLite formats.

Not yet implemented:

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
separate services. The mobile integration runs the TFLite model on the Android
device rather than uploading crop photos to either service.

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

The mobile classifier sums the softmax probabilities within each crop group.
Cassava and maize groups return their strongest supported disease or a
crop-specific unknown result. If the rice group wins, the app returns
`rice_unsupported` because this checkpoint does not cover the complete rice
class set.

The TFLite file accepts one RGB float32 image in NHWC shape
`[1, 224, 224, 3]`. Pixel values must be scaled to 0-1 and normalized with
ImageNet mean `[0.485, 0.456, 0.406]` and standard deviation
`[0.229, 0.224, 0.225]`. It returns float32 logits with shape `[1, 10]`.
See `mobile/src/ml/model/README.md` for the complete mobile handoff contract.

## Requirements

- Node.js 22.13 or newer
- Android Studio with an Android emulator
- JDK 17 for Android native builds
- Python 3.11 or newer for the synchronization backend

Use JDK 17 for `expo run:android`. The JDK 25 bundled with the currently
installed Android Studio can fail while Gradle configures native Prefab modules.
Confirm the active version with `java -version` and set `JAVA_HOME` to a JDK 17
installation before building.

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

This app uses native TFLite libraries, so it must run in a custom Expo
development build instead of Expo Go.

### 1. Start an Android emulator

Open Android Studio, select **More Actions > Virtual Device Manager**, and start
the configured phone emulator. Wait for Android to finish booting.

### 2. Configure the Android build environment

Open a terminal and set the Android SDK paths:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
```

The native toolchain currently requires JDK 17. If JDK 17 is registered with
macOS, select it with:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
```

On the current development machine, Gradle's downloaded JDK 17 can instead be
selected directly:

```bash
export JAVA_HOME="$HOME/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.20.1+1/Contents/Home"
```

Confirm that JDK 17 and the emulator are available:

```bash
java -version
adb devices
```

`java -version` should report version 17. `adb devices` should list an entry
such as `emulator-5554` with the state `device`.

### 3. Install dependencies and create the development build

From the repository root:

```bash
cd mobile
npm ci
npm run android
```

`npm ci` installs the exact versions recorded in `mobile/package-lock.json`.
The checked-in `mobile/.npmrc` preserves the peer-dependency mode used to create
that lockfile.
`npm run android` runs `expo run:android`: it generates the ignored native
Android project, compiles a custom development build containing the TFLite
runtime, installs it on the running emulator, and starts Metro. The first build
can take several minutes because Gradle compiles the native libraries.

### 4. Start later development sessions

After the development build is installed, leave the emulator running and start
Metro from `mobile/` with:

```bash
npx expo start --dev-client
```

Re-run `npm run android` whenever native dependencies, Expo plugins, or Android
build configuration change. Ordinary TypeScript, styling, and JSON changes only
require the development client and Metro.

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

## Model validation still required

The current crop and disease confidence thresholds are conservative prototype
defaults. Validate and calibrate them with held-out cassava and maize photos
before treating the output as production-ready. The first native build also
needs a manual Android emulator walkthrough covering every supported class,
both crop-specific unknown results, and the unsupported-rice path.

## Prototype limitations

Diagnosis and agricultural guidance are demonstration features and are not a
substitute for confirmation by a qualified agricultural extension professional.
Market prices are invented static values and must not be used for real buying or
selling decisions.
