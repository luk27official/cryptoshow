from celery import Celery
import torch
import time

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
from biotite.structure.io.pdbx import get_structure
from biotite.sequence import ProteinSequence

from esm2_generator import compute_esm2
from cb_small import compute_prediction

celery_app = Celery(
    "celery_app", broker="redis://redis:6379/0", backend="redis://redis:6379/0", broker_connection_retry_on_startup=True
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
    self.update_state(state="PROGRESS", meta={"status": "Downloading PDB file"})

    cif_file_path = rcsb.fetch(pdb_id, "cif", f"/app/data/inputs/")
    cif_file = pdbx.CIFFile.read(cif_file_path)

    chain_id = "A"  # TODO: change this

    self.update_state(state="PROGRESS", meta={"status": "Extracting sequence from PDB file"})

    protein = get_structure(cif_file, model=1)
    protein = protein[(protein.atom_name == "CA") & (protein.element == "C") & (protein.chain_id == chain_id)]

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
    with open(f"/app/data/inputs/{pdb_id}.fasta", "w") as f:
        f.write(seq)

    print(f"Saved sequence file to /app/data/inputs/{pdb_id}.fasta")

    self.update_state(state="PROGRESS", meta={"status": "Running ESM2 embedding computation"})

    # run the ml model
    try:
        compute_esm2(f"/app/data/inputs/{pdb_id}.fasta", f"/app/data/outputs/{pdb_id}.npy")
    except Exception as e:
        return {"status": "error", "error": str(e)}

    print(f"Saved ESM2 embeddings to /app/data/outputs/{pdb_id}.npy")

    self.update_state(state="PROGRESS", meta={"status": "Running CryptoBench prediction"})

    # run the cryptobench model
    try:
        pred = compute_prediction(f"/app/data/outputs/{pdb_id}.npy")
    except Exception as e:
        return {"status": "error", "error": str(e)}

    print(f"Got prediction for {pdb_id} from CryptoBench")

    return {
        "status": f"Prediction run succesfully for {pdb_id}. Available at /app/data/outputs/{pdb_id}.npy",
        "prediction": [float(p) for p in pred],
    }
