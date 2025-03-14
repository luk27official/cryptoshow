from celery import Celery
import torch
import time
import os
import json

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
from biotite.structure.io.pdbx import get_structure
from biotite.sequence import ProteinSequence

from esm2_generator import compute_esm2
from cb_small import compute_prediction
from clustering import compute_clusters

celery_app = Celery(
    "celery_app",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    broker_connection_retry_on_startup=True,
    result_expires=0,
)


@celery_app.task(name="celery_app.process_string_test", bind=True)
def process_string_test(self, string: str):
    """Run ML inference on the uploaded 3D structure."""
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Simulate ML model inference
    time.sleep(3)  # Fake processing time
    result = {"device": device, "string": string}

    return result


@celery_app.task(name="celery_app.process_esm2_cryptobench", bind=True)
def process_esm2_cryptobench(self, pdb_id: str):
    """Run ESM2 and CryptoBench models on the uploaded 3D structure."""
    task_id = self.request.id

    JOB_PATH = f"/app/data/jobs/{task_id}"

    os.makedirs(JOB_PATH, exist_ok=True)

    self.update_state(state="PROGRESS", meta={"status": "Downloading PDB file"})

    STRUCTURE_FILE = os.path.join(JOB_PATH, "structure.cif")

    cif_file_path = rcsb.fetch(pdb_id, "cif", JOB_PATH)
    os.rename(cif_file_path, STRUCTURE_FILE)
    cif_file = pdbx.CIFFile.read(STRUCTURE_FILE)

    self.update_state(state="PROGRESS", meta={"status": "Extracting sequence from PDB file"})

    protein = get_structure(cif_file, model=1)
    protein = protein[(protein.atom_name == "CA") & (protein.element == "C")]  # & (protein.chain_id == chain_id)]

    seq = "".join(
        [
            (
                ProteinSequence.convert_letter_3to1(residue.res_name)
                if residue.res_name in ProteinSequence._dict_3to1
                else "X"
            )
            for residue in protein
        ]
    )

    SEQUENCE_FILE = os.path.join(JOB_PATH, "seq.fasta")

    with open(SEQUENCE_FILE, "w") as f:
        f.write(seq)

    print(f"Saved sequence file to {SEQUENCE_FILE}")

    self.update_state(state="PROGRESS", meta={"status": "Extracting 3D coordinates from PDB file"})

    coordinates = []
    for residue in protein:
        coordinates.append(residue.coord)

    coordinates = [[float(c) for c in coord] for coord in coordinates]
    print(f"Extracted 3D coordinates")

    self.update_state(state="PROGRESS", meta={"status": "Running ESM2 embedding computation"})

    # run the ml model
    # TODO: fix the error handling etc
    EMBEDDING_FILE = os.path.join(JOB_PATH, "embedding.npy")
    try:
        compute_esm2(SEQUENCE_FILE, EMBEDDING_FILE)
    except Exception as e:
        return {"status": "error", "error": str(e)}

    print(f"Saved ESM2 embeddings to {EMBEDDING_FILE}")

    self.update_state(state="PROGRESS", meta={"status": "Running CryptoBench prediction"})

    # run the cryptobench model
    # TODO: fix the error handling etc
    try:
        pred = compute_prediction(EMBEDDING_FILE)
    except Exception as e:
        return {"status": "error", "error": str(e)}

    print(f"Got prediction for {pdb_id} from CryptoBench")
    cryptobench_prediction = [float(p) for p in pred]

    # run clustering
    pockets = compute_clusters(coordinates, cryptobench_prediction)
    pockets = [int(p) for p in pockets]

    task_data = {
        "status": "SUCCESS",
        "prediction": cryptobench_prediction,
        "pockets": pockets,
        "sequence": list(seq),
        "residue_ids": [f"{residue.chain_id}_{residue.res_id}" for residue in protein],
        "input_structure": STRUCTURE_FILE,
        "task_id": task_id,
    }

    # save the results to a file
    RESULTS_FILE = os.path.join(JOB_PATH, "results.json")

    with open(RESULTS_FILE, "w") as f:
        json.dump(task_data, f)

    return task_data
