from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.logger import logger
from fastapi.responses import FileResponse

import json
import asyncio
import logging
import random
import os

# TODO: this is here for debugging when behind a proxy !!!
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
# TODO remove

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
from biotite.structure.io.pdbx import get_structure
from biotite.sequence import ProteinSequence

from .tasks import celery_app
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


@app.get("/debug/{pdb_id}")
async def run_pdb_id(pdb_id: str):

    logger.warning(f"debug: GET /{pdb_id}")

    print("Converting the file to a sequence")
    # download the pdb
    cif_file_path = rcsb.fetch(pdb_id, "cif", f"/app/data/")
    cif_file = pdbx.CIFFile.read(cif_file_path)

    protein = get_structure(cif_file, model=1)
    protein = protein[(protein.atom_name == "CA") & (protein.element == "C")]

    seq = "".join([ProteinSequence.convert_letter_3to1(residue.res_name) for residue in protein])

    print(f"Saved sequence file to /app/data/{pdb_id}.fasta")

    pred = [[x, 1 - x] for x in [random.random() for _ in range(len(seq))]]

    return {
        "status": f"Prediction run succesfully for {pdb_id}.",
        "prediction": [float(p) for p in pred],
    }


@app.get("/calculate/{pdb_id}")
async def calculate(pdb_id: str):
    """Calculates the prediction for a given PDB ID."""
    task: AsyncResult = celery_app.send_task("celery_app.process_esm2_cryptobench", args=(pdb_id,))

    return {"task_id": task.id}


@app.get("/process/{id}")
async def process_string_test(id: str):
    """Uploads a string and starts processing."""
    test_string = id + "_hi"

    task: AsyncResult = celery_app.send_task("celery_app.process_string_test", args=(test_string,))
    return {"task_id": task.id}


@app.get("/task-status/{task_id}")
def get_status(task_id: str):
    """Check the status of a processing task."""
    task_result: AsyncResult = celery_app.AsyncResult(task_id)
    return {"status": task_result.state, "result": task_result.result}


@app.get("/file/{task_id}/{filename}")
def get_file(task_id: str, filename: str):
    """Get the file at the given path for a given task id (in the /app/data directory)."""
    path = os.path.join("/app/data/jobs", task_id, filename)

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

            # # Stop if task is done
            # if result.status in ["SUCCESS", "FAILURE", "REVOKED"]:
            #     break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from task status websocket for task_id: {task_id}")
    except Exception as e:
        logger.error(f"Error in websocket connection for task_id {task_id}: {str(e)}")
