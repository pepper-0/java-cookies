# LimaDRC prototype backend

This FastAPI service is a local prototype integration layer for Checkpoint 1. It is not a government API.

## Run

Use Python 3.11 or newer:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The Android emulator reaches it at `http://10.0.2.2:8000`. A physical device must use the development computer's LAN address, such as `http://192.168.1.20:8000`.

Data is written to `backend/database/limadrc.db`. POST requests are idempotent by `local_id`, so retrying a pending record does not create a duplicate.

## Test

```bash
pytest -q
```
