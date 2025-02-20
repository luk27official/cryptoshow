from celery import Celery
import torch
import time

celery_app = Celery("celery_app", broker="redis://redis:6379/0", backend="redis://redis:6379/0")


@celery_app.task(name="process_3d_structure")
def process_3d_structure(file_path: str):
    """Run ML inference on the uploaded 3D structure."""
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Simulate ML model inference
    time.sleep(3)  # Fake processing time
    result = {"device": device, "prediction": "3D structure processed"}

    return result
