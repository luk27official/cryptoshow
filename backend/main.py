from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.logger import logger
from fastapi.responses import FileResponse

import json
import asyncio
import logging
import os
import shutil

# TODO: this is here for debugging when behind a proxy !!!
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
# TODO remove

import biotite.database.rcsb as rcsb

from .tasks import celery_app
from .utils import get_existing_result, generate_random_folder_name
from celery.result import AsyncResult

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost"],  # TODO: what should this be when the app is deployed?
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uvicorn_logger = logging.getLogger("uvicorn.error")
logger.handlers = uvicorn_logger.handlers
logger.setLevel(logging.DEBUG)


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/gpu-status")
async def gpu_status():
    """Check if CUDA is available."""
    task: AsyncResult = celery_app.send_task("celery_app.cuda_test")

    return {"task_id": task.id}


@app.get("/health")
async def health():
    """Check if the server is healthy."""
    return {"status": "healthy"}


@app.post("/calculate")
async def calculate(request: dict):
    """Calculates the prediction for a given PDB ID."""
    if "pdb" not in request:
        return {"error": "Missing 'pdb' field in request"}

    pdb_id = request["pdb"]

    tmp_dir = f"/app/data/jobs/{generate_random_folder_name()}"
    os.makedirs(tmp_dir, exist_ok=True)

    # TODO: handle errors
    cif_file_path: str = rcsb.fetch(pdb_id, "cif", tmp_dir)  # type: ignore

    result = get_existing_result(cif_file_path)
    if result:
        return result

    task: AsyncResult = celery_app.send_task("celery_app.process_esm2_cryptobench", args=(cif_file_path,))

    return {"task_id": task.id}


@app.post("/calculate-custom")
async def calculate_custom(file: UploadFile = File(...)):
    """Upload a PDB/CIF file and calculate the prediction."""
    if not file or not file.filename:
        return {"error": "No file uploaded."}

    if not file.filename.lower().endswith((".pdb", ".cif", ".pdb1")):
        return {"error": "Only .pdb, .pdb1 and .cif files are supported"}

    tmp_dir = f"/app/data/jobs/{generate_random_folder_name()}"
    os.makedirs(tmp_dir, exist_ok=True)

    file_path = os.path.join(tmp_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = get_existing_result(file_path)
    if result:
        return result

    # the temporary file will be processed by the task and can be deleted afterward by the task

    task: AsyncResult = celery_app.send_task("celery_app.process_esm2_cryptobench", args=(file_path,))

    return {"task_id": task.id}


@app.get("/task-status/{task_id}")
def get_status(task_id: str):
    """Check the status of a processing task."""
    task_result: AsyncResult = celery_app.AsyncResult(task_id)
    return {"status": task_result.state, "result": task_result.result}


@app.get("/file/{task_hash}/{filename}")
def get_file(task_hash: str, filename: str):
    """Get the file at the given path for a given task id (in the /app/data directory)."""
    if ".." in task_hash or ".." in filename:
        return {"error": f"Nice try, but no."}

    path = os.path.join("/app/data/jobs", task_hash, filename)

    if os.path.exists(path):
        return FileResponse(path, filename=filename, media_type="application/octet-stream")

    return {"error": f"File not found: {path}"}


@app.websocket("/ws/task-status/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()

    try:
        while True:
            result = celery_app.AsyncResult(task_id)
            status_info = {"task_id": task_id, "status": result.status, "result": result.result}

            # Send task status to frontend
            await websocket.send_text(json.dumps(status_info))

            # We expect the frontend to disconnect when the task is done...
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from task status websocket for task_id: {task_id}")
    except Exception as e:
        logger.error(f"Error in websocket connection for task_id {task_id}: {str(e)}")
