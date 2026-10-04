# Crop Disease Identification API

This repository contains the training notebook and a FastAPI backend for classifying crop leaf images with a MobileNetV3-Large model.

## Project structure

```text
app/
	__init__.py
	main.py        # FastAPI application and POST /predict endpoint
	model.py       # Model loading, preprocessing, and inference
models/
	mobilenetv3_crop_diseases.pth  # Add the trained checkpoint here (not included)
java_cookies.ipynb              # Data preparation and model training pipeline
requirements.txt
```

The backend is configured for the nine classes shown in the notebook's recorded training output. Its class order matches the alphabetical order used by `torchvision.datasets.ImageFolder`. The checkpoint must have been trained with those same nine classes, in that order.

## Kaggle credentials for notebook training

The notebook downloads datasets using Kaggle credentials. For local runs, create a `.env` file in the repository root based on `.env.example`, fill in your Kaggle username and a newly generated API key, then install the dependencies (which include `python-dotenv`). `.env` is ignored by Git; never commit or paste credentials into the notebook.

In Google Colab, the runtime cannot read a `.env` file stored on your computer. Instead, add `KAGGLE_USERNAME` and `KAGGLE_KEY` as Colab Secrets (key icon in the left sidebar) and enable notebook access for each secret. The setup cell reads these secrets when available and writes Kaggle's expected `kaggle.json` file into the runtime. Do not print or share the secret values.

## Run locally

1. Use Python 3.10 or newer and create/activate a virtual environment.
2. Install the dependencies:

	 ```powershell
	 python -m pip install -r requirements.txt
	 ```

	 For GPU support, install the PyTorch and Torchvision builds appropriate for your CUDA version from the [official PyTorch install selector](https://pytorch.org/get-started/locally/).
3. Copy the trained `mobilenetv3_crop_diseases.pth` file into `models/`. The weights are not checked into this repository; for large checkpoints, use Git LFS or another model artifact store.
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
