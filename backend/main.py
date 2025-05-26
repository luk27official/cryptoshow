from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Path, Body
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.logger import logger
from fastapi.responses import FileResponse, JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from models import (
    CalculateRequest,
    CalculateResponse,
    TaskStatusResponse,
    FileResponseModel,
    ProxyRequest,
    HealthResponse,
)

import httpx
import json
import asyncio
import logging
import os
import shutil

ENABLE_EXTERNAL_SSL_REQUESTS = os.getenv("ENABLE_EXTERNAL_SSL_REQUESTS", "true").lower() == "true"
# for edge cases when the server is behind a proxy and we want to disable SSL verification
# this should always be set to True in production!
if not ENABLE_EXTERNAL_SSL_REQUESTS:
    import ssl

    ssl._create_default_https_context = ssl._create_unverified_context

from .tasks import celery_app
from .utils import get_existing_result, generate_random_folder_name, download_cif_file
from .commons import JOBS_BASE_PATH
from celery.result import AsyncResult

app = FastAPI(openapi_url="/api/openapi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "https://localhost",
        "https://apoholo.cz",
        "http://cryptoshow.ksi.projekty.ms.mff.cuni.cz",
        "https://cryptoshow.ksi.projekty.ms.mff.cuni.cz",
    ],
    # TODO: what should this be when the app is deployed?
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app, include_in_schema=False)

uvicorn_logger = logging.getLogger("uvicorn.error")
logger.handlers = uvicorn_logger.handlers
logger.setLevel(logging.DEBUG)


def generate_openapi_schema():
    """Generate the OpenAPI schema for the FastAPI application.

    Returns:
        dict: The OpenAPI schema.
    """
    return get_openapi(
        title="CryptoShow API",
        version="1.0.0",
        description="CryptoShow API",
        routes=app.routes,
    )


@app.get("/", response_model=dict)
async def read_root():
    """Root endpoint."""
    return {"Hello": "World"}


@app.get("/openapi", response_model=dict)
def get_openapi_endpoint():
    """Retrieve the generated OpenAPI schema."""
    return JSONResponse(content=generate_openapi_schema())


@app.get("/gpu-status", response_model=CalculateResponse)
async def gpu_status():
    """Check if CUDA is available."""
    task: AsyncResult = celery_app.send_task("celery_app.cuda_test")

    return {"task_id": task.id}


@app.get("/health", response_model=HealthResponse)
async def health():
    """Check if the server is healthy."""
    return {"status": "healthy"}


@app.post("/calculate", response_model=CalculateResponse)
async def calculate(
    request: CalculateRequest = Body(
        ..., example={"pdb": "2src"}, description="Request object containing the PDB/AF ID"
    )
):
    """Calculates the prediction for a given PDB ID.

    Args:
        request (CalculateRequest): The request body containing the PDB ID.
    """
    if "pdb" not in request.model_dump():
        return JSONResponse(status_code=400, content={"error": "Missing 'pdb' field in request."})

    pdb_id = request.pdb

    tmp_dir = os.path.join(JOBS_BASE_PATH, generate_random_folder_name())
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        cif_file_path: str = download_cif_file(pdb_id, tmp_dir)  # type: ignore
        if not cif_file_path:
            return JSONResponse(status_code=400, content={"error": "PDB ID not found."})

        # Here, we check if the file is actually a CIF file, and not an error message - wrong PDB ID might return a HTML file.
        with open(cif_file_path, "r") as f:
            cif_file_content = f
            if "400 Bad Request" in cif_file_content.read() or "404 Not Found" in cif_file_content.read():
                shutil.rmtree(tmp_dir)
                return JSONResponse(status_code=400, content={"error": "PDB ID not found."})

    except Exception as e:
        shutil.rmtree(tmp_dir)
        return JSONResponse(
            status_code=400,
            content={"error": "Could not load the structure from the PDB ID. Perhaps it does not exist?"},
        )

    result = get_existing_result(cif_file_path)
    if result:
        shutil.rmtree(tmp_dir)
        return result

    task: AsyncResult = celery_app.send_task(
        "celery_app.process_esm2_cryptobench",
        args=(
            cif_file_path,
            pdb_id,
        ),
    )

    return {"task_id": task.id}


@app.post("/calculate-custom", response_model=CalculateResponse)
async def calculate_custom(file: UploadFile = File(..., description="PDB/CIF file to be processed")):
    """Upload a PDB/CIF file and calculate the prediction.

    Args:
        file (UploadFile): The uploaded PDB/CIF file.
    """

    if not file or not file.filename:
        return JSONResponse(status_code=400, content={"error": "No file uploaded."})

    if not file.filename.lower().endswith((".pdb", ".cif", ".pdb1")):
        return JSONResponse(status_code=400, content={"error": "Only .pdb, .pdb1 and .cif files are supported."})

    tmp_dir = os.path.join(JOBS_BASE_PATH, generate_random_folder_name())
    os.makedirs(tmp_dir, exist_ok=True)

    file_path = os.path.join(tmp_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = get_existing_result(file_path)
    if result:
        shutil.rmtree(tmp_dir)
        return result

    task: AsyncResult = celery_app.send_task(
        "celery_app.process_esm2_cryptobench",
        args=(
            file_path,
            "custom",
        ),
    )

    return {"task_id": task.id}


@app.get("/task-status/{task_id}", response_model=TaskStatusResponse)
def get_status(
    task_id: str = Path(..., example="123e4567-e89b-12d3-a456-123123123000", description="The ID of the task to check")
):
    """
    Check the status of a processing task.
    If a hash of the structure is used, look for a folder with such a name in the /app/data/jobs directory.

    Args:
        task_id (str): The task ID to check the status for.
    """

    RESULTS_FILE = os.path.join(JOBS_BASE_PATH, task_id, "results.json")

    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "r") as f:
            return {"status": "SUCCESS", "result": json.load(f)}

    elif len(task_id) < 8:
        # Consider this to be a PDB/AF id.
        try:
            result = get_existing_result(download_cif_file(task_id))
            if result:
                return {"status": "SUCCESS", "result": result}
        except Exception as e:
            return {"status: 'FAILURE', result": f"Failed to find the task result: {str(e)}"}

    task_result: AsyncResult = celery_app.AsyncResult(task_id)

    # Serialize exceptions to string
    result_value = task_result.result
    if isinstance(result_value, Exception):
        result_value = str(result_value)

    return {"status": task_result.state, "result": result_value, "error": None}


@app.get("/file/{task_hash}/{filename}", response_model=FileResponseModel)
def get_file(
    task_hash: str = Path(
        ..., example="123e4567-e89b-12d3-a456-123123123000", description="The task hash to get the file for"
    ),
    filename: str = Path(..., example="results.json", description="The name of the file to get"),
):
    """Get the file at the given path for a given task id (in the /app/data directory).

    Args:
        task_hash (str): The task hash to get the file for.
        filename (str): The name of the file to get.
    """

    if ".." in task_hash or ".." in filename:
        return JSONResponse(status_code=403, content={"error": "Nice try, but no."})

    path = os.path.join(JOBS_BASE_PATH, task_hash, filename)

    if os.path.exists(path):
        return FileResponse(path, filename=filename, media_type="application/octet-stream")

    return JSONResponse(status_code=404, content={"error": f"File not found: {path}"})


@app.get("/animate/{task_hash}/{aligned_structure_filename}/{target_chains}", response_model=CalculateResponse)
def get_animated_file(
    task_hash: str = Path(
        ..., example="123e4567-e89b-12d3-a456-123123123000", description="The task hash to get the file for"
    ),
    aligned_structure_filename: str = Path(
        ..., example="aligned_structure.pdb", description="The name of the aligned structure file from AHoJ"
    ),
    target_chains: str = Path(
        ..., example="A,B,C", description="The target chains to animate (in the format 'A,B,C,...')"
    ),
):
    """Create an animated trajectory file for a given task hash and aligned structure filename.
    This runs a Celery task to generate the trajectory.

    Args:
        task_hash (str): The task hash to get the file for.
        aligned_structure_filename (str): The name of the aligned structure file from AHoJ.
        target_chains (str): The target chains to animate (in the format "A,B,C,...").
    """
    if ".." in task_hash or ".." in aligned_structure_filename:
        return JSONResponse(status_code=403, content={"error": "Nice try, but no."})

    task: AsyncResult = celery_app.send_task(
        "celery_app.generate_trajectory",
        args=(task_hash, aligned_structure_filename, target_chains),
    )

    return {"task_id": task.id}


@app.websocket("/ws/task-status/{task_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    task_id: str = Path(..., example="123e4567-e89b-12d3-a456-123123123000", description="The ID of the task to check"),
):
    """Websocket endpoint for getting the status of a processing task.

    Args:
        websocket (WebSocket): The WebSocket connection.
        task_id (str): The task ID to check the status for.
    """

    await websocket.accept()

    try:
        RESULTS_FILE = os.path.join(JOBS_BASE_PATH, task_id, "results.json")

        while True:
            if os.path.exists(RESULTS_FILE):
                with open(RESULTS_FILE, "r") as f:
                    await websocket.send_text(
                        json.dumps({"task_id": task_id, "status": "SUCCESS", "result": json.load(f)})
                    )

            else:
                result = celery_app.AsyncResult(task_id)

                # Serialize exceptions to string
                result_value = result.result
                if isinstance(result_value, Exception):
                    result_value = str(result_value)

                status_info = {"task_id": task_id, "status": result.status, "result": result_value}

                # Send task status to frontend
                await websocket.send_text(json.dumps(status_info))

            # We expect the frontend to disconnect when the task is done...
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from task status websocket for task_id: {task_id}")
    except Exception as e:
        logger.error(f"Error in websocket connection for task_id {task_id}: {str(e)}")


@app.post("/proxy/ahoj/job", response_model=dict)
async def proxy_ahoj_calcluate(
    request: ProxyRequest = Body(
        ...,
        example={"job_name": "CryptoShow 2SRC A LYS 123", "queries": "2SRC A LYS 123", "options": {}},
        description="The request data to be sent to apoholo.cz/api/job",
    )
):
    """Proxy POST request to apoholo.cz/api/job endpoint (for job posting).

    Args:
        request (ProxyRequest): The request body containing the job data.
    """

    url = "https://apoholo.cz/api/job"
    try:
        async with httpx.AsyncClient(verify=ENABLE_EXTERNAL_SSL_REQUESTS) as client:
            response = await client.post(url, json=request.model_dump())
            return response.json()
    except Exception as e:
        logger.error(f"Error proxying request to apoholo.cz: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy request: {str(e)}"})


@app.get("/proxy/ahoj/{task_hash}/{path:path}", response_model=FileResponseModel)
async def proxy_ahoj_get(
    task_hash: str = Path(
        ..., example="123e4567-e89b-12d3-a456-123123123000", description="The task hash to get the file for"
    ),
    path: str = Path(..., example="api/results/structure.pdb", description="The path to the file on apoholo.cz"),
):
    """Proxy GET request to apoholo.cz/<path> endpoint.

    Args:
        task_hash (str): The task hash to get the file for.
        path (str): The path to the file on apoholo.cz.
    """

    url = f"https://apoholo.cz/{path}"

    if ".." in task_hash or ".." in path:
        return JSONResponse(status_code=403, content={"error": "Nice try, but no."})

    try:
        async with httpx.AsyncClient(verify=ENABLE_EXTERNAL_SSL_REQUESTS) as client:
            response = await client.get(url)

            if response.headers.get("Content-Type") == "application/json":
                return JSONResponse(content=response.json())

            else:
                file_name = path.split("/")[-1]
                file_path = os.path.join(JOBS_BASE_PATH, task_hash, file_name)

                os.makedirs(os.path.dirname(file_path), exist_ok=True)  # this should already exist, but just in case
                with open(file_path, "wb") as f:
                    f.write(response.content)

                return JSONResponse(
                    content={
                        "file_path": file_path,
                        "file_name": file_name,
                        "message": "File downloaded successfully.",
                    }
                )

    except Exception as e:
        logger.error(f"Error proxying request to apoholo.cz: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy request: {str(e)}"})
