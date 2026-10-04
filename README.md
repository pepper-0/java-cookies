# LimaDRC App Shell

Checkpoint implementation of an offline-first Android agriculture app for smallholder farmers in the DRC. The repository deliberately stops before real image-model integration and live market, speech, or mapping services.

## What is implemented

- Expo and React Native Android application with Expo Router
- Home, Diagnose, Result, My Farm, and Sync Status screens
- Android camera and gallery photo selection
- isolated asynchronous mock classifier contract
- MobileNetV3Small training, evaluation, and TFLite-export scaffold awaiting image datasets
- offline market-price screen with clearly labeled static demonstration prices
- offline SQLite observation records without retaining crop photos or image URLs
- locally saved farmer, farm, and observation data
- explicit `PENDING` to `SYNCED` queue behavior
- FastAPI health, farmer, farm, and observation endpoints
- idempotent backend writes backed by SQLite
- editable backend address for emulator and physical-device testing

## INSTALL AN ANDROID STUDIO EMULATOR FIRST TO RUN THIS APP

## Start the backend

Open a terminal at the repository root and run:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The commands do the following:

- `cd backend` moves the terminal into the backend project directory.
- `python3 -m venv .venv` creates an isolated Python environment in `backend/.venv`. It is ignored by Git.
- `source .venv/bin/activate` makes that environment active in the current terminal. Run it again whenever you open a new terminal for the backend.
- `python -m pip install -r requirements.txt` installs the pinned FastAPI server and test dependencies into the active environment.
- `python -m uvicorn main:app ...` loads the `app` object from `backend/main.py` and starts the API. `--host 0.0.0.0` allows a phone on the same network to reach it, `--port 8000` selects the port, and `--reload` restarts the server after Python file changes.

Leave this process running while using the app. Press `Control-C` to stop it.

## Start the Android app

Expo SDK 57 requires Node.js 22.13 or newer.

Open a second terminal at the repository root and run:

```bash
cd mobile
npm install
npm run android
```

- `cd mobile` moves the terminal into the Expo application directory.
- `npm install` installs the versions recorded in `mobile/package-lock.json` into the ignored `mobile/node_modules` directory.
- `npm run android` starts the Expo development server and attempts to open the app on a connected Android emulator or device. Keep this process running during development and press `Control-C` to stop it.

The default backend address is `http://10.0.2.2:8000`, which is correct for the Android emulator. On a physical phone, open **Sync status** and replace it with the computer's LAN address.

## Checkpoint demo

1. Start the backend.
2. Launch the Android app and optionally save a farmer in **My farm**.
3. Open **Diagnose crop**, take or select a cassava photo, and run the mock diagnosis.
4. Save the observation. Its diagnosis metadata is stored locally as `PENDING`; the crop photo is not retained.
5. Open **Sync status**. It shows the pending-record count.
6. Test the backend connection, then tap **Sync now**.
7. The backend confirms each POST and the app changes the local records to `SYNCED`.
8. Stop the backend and repeat a save to verify that a failed sync leaves the local record `PENDING`.

## Intentional stopping point

There is no trained TFLite or ONNX model, TTS, live market-price provider, or production registry integration. The bundled prices are invented demonstration values and must not be used for real transactions. The dataset-ready training pipeline is documented in `mobilenetv3-training/README.md`, and the future app adapter is documented in `mobile/src/ml/model/README.md`.
