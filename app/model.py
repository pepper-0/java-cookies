"""Model loading and image prediction helpers for crop disease classification."""

import io
from typing import Union

import torch
from PIL import Image
from torchvision import models, transforms

# Keep this in the alphabetical order used by torchvision.datasets.ImageFolder
# in the recorded nine-class training run in java_cookies.ipynb.
CLASS_NAMES = [
    "cassava_bacterial_blight",
    "cassava_mosaic_disease",
    "maize_common_rust",
    "maize_northern_leaf_blight",
    "maize_streak_disease",
    "rice_bacterial_blight",
    "rice_blast",
    "rice_healthy",
    "rice_yellow_mottle_disease",
]

_PREPROCESS = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


def load_crop_model(
    weights_path: str, num_classes: int = len(CLASS_NAMES), device: Union[str, torch.device] = "cpu"
) -> torch.nn.Module:
    """Create MobileNetV3-Large and load a state-dict checkpoint."""
    if num_classes != len(CLASS_NAMES):
        raise ValueError(f"This checkpoint expects {len(CLASS_NAMES)} classes.")

    model = models.mobilenet_v3_large(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = torch.nn.Linear(in_features, num_classes)

    state_dict = torch.load(weights_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model


def predict_crop_disease(
    image_bytes: bytes,
    model: torch.nn.Module,
    device: Union[str, torch.device] = "cpu",
) -> tuple[str, float]:
    """Predict a disease class and return its confidence from 0 to 1."""
    with Image.open(io.BytesIO(image_bytes)) as image:
        input_tensor = _PREPROCESS(image.convert("RGB")).unsqueeze(0).to(device)

    with torch.inference_mode():
        outputs = model(input_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        confidence, class_index = torch.max(probabilities, dim=0)

    return CLASS_NAMES[class_index.item()], confidence.item()
