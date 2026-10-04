# Crop Disease Identification API

This repository contains the training notebook and a FastAPI backend for classifying crop leaf images with a MobileNetV3-Large model.

## Project structure

```text
app/
	__init__.py
	main.py        # FastAPI application and POST /predict endpoint
	model.py       # Model loading, preprocessing, and inference
models/
	.gitkeep       # Reserved for future model artifacts
weights/
	mobilenetv3_crop_diseases.pth  # Trained state-dict checkpoint
java_cookies.ipynb              # Data preparation and model training pipeline
requirements.txt
```

The checkpoint's final classifier has 10 outputs, but the notebook's recorded training output reports 9 classes. A PyTorch `state_dict` does not store class names, so the checkpoint's output-to-label mapping cannot be verified from the artifact alone. Confirm the training run's `full_dataset.classes` order and update `app/model.py`'s `CLASS_NAMES` before relying on returned disease labels. The deployment head size must match the checkpoint (10 outputs).

## Kaggle credentials for notebook training

The notebook downloads datasets using Kaggle credentials. For local runs, create a `.env` file in the repository root with `KAGGLE_USERNAME` and `KAGGLE_KEY`, then install the dependencies (which include `python-dotenv`). `.env` is ignored by Git; never commit or paste credentials into the notebook.

In Google Colab, the runtime cannot read a `.env` file stored on your computer. Instead, add `KAGGLE_USERNAME` and `KAGGLE_KEY` as Colab Secrets (key icon in the left sidebar) and enable notebook access for each secret. The setup cell reads these secrets when available and writes Kaggle's expected `kaggle.json` file into the runtime. Do not print or share the secret values.

## Run locally

1. Use Python 3.10 or newer and create/activate a virtual environment.
2. Install the dependencies:

	 ```powershell
	 python -m pip install -r requirements.txt
	 ```

	 For GPU support, install the PyTorch and Torchvision builds appropriate for your CUDA version from the [official PyTorch install selector](https://pytorch.org/get-started/locally/).
3. The trained `mobilenetv3_crop_diseases.pth` checkpoint is expected in `weights/` (the current workspace includes it there). To use a different checkpoint, set `CROP_MODEL_WEIGHTS` to its path. For large checkpoints, use Git LFS or another model artifact store.
4. Start the API from the repository root:

	 ```powershell
	 uvicorn app.main:app --reload
	 ```

	 To load weights from another location, set `CROP_MODEL_WEIGHTS` to the checkpoint path before starting the server.
5. Open `http://127.0.0.1:8000/docs` to try the interactive API documentation.

## Endpoint

`POST /predict` accepts a multipart form upload named `file` containing a JPEG or PNG image. A successful response looks like:

```json
{
	"disease": "rice_healthy",
	"confidence": 98.42,
	"status": "success"
}
```

The confidence is a percentage. This model is a classification aid and should not be treated as a substitute for expert diagnosis.

## Checkpoint details

The `.pth` file is a `state_dict`, not a serialized model object. The loader rebuilds MobileNetV3-Large with a 10-output classifier and loads the saved parameters strictly.
