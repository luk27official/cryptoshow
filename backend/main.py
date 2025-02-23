from fastapi import FastAPI
from fastapi.logger import logger

import logging
import random

# TODO: this is here for debugging when behind a proxy !!!
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
# TODO remove

# TODO: set this to false once we're done with mocking the output
DEBUG = True

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
from biotite.structure.io.pdbx import get_structure
from biotite.sequence import ProteinSequence


from .esm2_generator import compute_esm2
from .cb import compute_prediction
from .tasks import process_3d_structure

app = FastAPI()
uvicorn_logger = logging.getLogger("uvicorn.error")
logger.handlers = uvicorn_logger.handlers
logger.setLevel(logging.DEBUG)


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/{pdb_id}")
async def run_pdb_id(pdb_id: str):

    logger.warning(f"new request: GET /{pdb_id}")

    print("Converting the file to a sequence")
    # download the pdb
    cif_file_path = rcsb.fetch(pdb_id, "cif", f"/app/data/inputs/")
    cif_file = pdbx.CIFFile.read(cif_file_path)

    chain_id = "A"

    protein = get_structure(cif_file, model=1)
    protein = protein[(protein.atom_name == "CA") & (protein.element == "C") & (protein.chain_id == chain_id)]

    seq = "".join([ProteinSequence.convert_letter_3to1(residue.res_name) for residue in protein])
    with open(f"/app/data/inputs/{pdb_id}.fasta", "w") as f:
        f.write(seq)

    print(f"Saved sequence file to /app/data/inputs/{pdb_id}.fasta")

    # run the ml model
    if not DEBUG:
        try:
            compute_esm2(f"/app/data/inputs/{pdb_id}.fasta", f"/app/data/outputs/{pdb_id}.npy")
        except Exception as e:
            logger.error(f"Error running ESM2 model: {e}")
            return {"error": str(e)}

        print(f"Saved ESM2 embeddings to /app/data/outputs/{pdb_id}.npy")

    # run the cryptobench model
    if DEBUG:
        pred = [[x, 1 - x] for x in [random.random() for _ in range(len(seq))]]
    else:
        try:
            pred = compute_prediction(f"/app/data/outputs/{pdb_id}.npy")
        except Exception as e:
            logger.error(f"Error running ESM2 model: {e}")
            return {"error": str(e)}

    print(f"Prediction: {pred}")

    return {
        "status": f"Prediction run succesfully for {pdb_id}. Available at /app/data/outputs/{pdb_id}.npy",
        "prediction": [float(p[1]) for p in pred],
    }


@app.post("/process/{id}")
async def process_string_test(id: str):
    """Uploads a string and starts processing."""
    test_string = id + "_hi"

    task = process_3d_structure.delay(test_string)  # Send job to Celery
    return {"task_id": task.id}


@app.get("/task-status/{task_id}")
def get_status(task_id: str):
    """Check the status of a processing task."""
    task_result = process_3d_structure.AsyncResult(task_id)
    return {"status": task_result.state, "result": task_result.result}
