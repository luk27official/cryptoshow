from celery import Celery
import torch
import os
import json
import shutil

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
import biotite.structure.io.pdb as pdb
from biotite.structure import AtomArray
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


@celery_app.task(name="celery_app.cuda_test", bind=True)
def process_string_test(self):
    """CUDA test."""
    return {"device": "cuda" if torch.cuda.is_available() else "cpu"}


@celery_app.task(name="celery_app.process_esm2_cryptobench", bind=True)
def process_esm2_cryptobench(self, structure: str):
    """Run ESM2 and CryptoBench models on the uploaded 3D structure.

    Parameters
    ----------
    structure : str
        PDB ID or path to the uploaded structure file
    """

    task_id = self.request.id

    JOB_PATH = f"/app/data/jobs/{task_id}"

    os.makedirs(JOB_PATH, exist_ok=True)

    SUPPORTED_FORMATS = [".cif", ".pdb", ".pdb1"]

    if not any([structure.lower().endswith(ext) for ext in SUPPORTED_FORMATS]):
        # then download the structure from the PDB
        self.update_state(state="PROGRESS", meta={"status": "Downloading PDB file"})

        cif_file_path: str = rcsb.fetch(structure, "cif", JOB_PATH)  # type: ignore
        STRUCTURE_FILE = os.path.join(JOB_PATH, "structure.cif")
        shutil.move(cif_file_path, STRUCTURE_FILE)
        structure_file = pdbx.CIFFile.read(STRUCTURE_FILE)

        self.update_state(state="PROGRESS", meta={"status": "Extracting sequence from PDB file"})

        protein = pdbx.get_structure(structure_file, model=1)  # type: ignore
    else:
        self.update_state(state="PROGRESS", meta={"status": "Still processing custom file"})

        # detect the format
        if structure.lower().endswith(".cif"):
            STRUCTURE_FILE = os.path.join(JOB_PATH, "structure.cif")
            shutil.move(structure, STRUCTURE_FILE)
            structure_file = pdbx.CIFFile.read(STRUCTURE_FILE)
            protein = pdbx.get_structure(structure_file, model=1)  # type: ignore

        elif structure.lower().endswith((".pdb", ".pdb1")):
            STRUCTURE_FILE = os.path.join(JOB_PATH, "structure.pdb")
            shutil.move(structure, STRUCTURE_FILE)
            structure_file = pdb.PDBFile.read(STRUCTURE_FILE)
            protein = pdb.get_structure(structure_file, model=1)  # type: ignore

        else:
            raise ValueError("Unsupported file format")

    protein: AtomArray = protein[(protein.atom_name == "CA") & (protein.element == "C")]  # type: ignore

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
    compute_esm2(SEQUENCE_FILE, EMBEDDING_FILE)

    print(f"Saved ESM2 embeddings to {EMBEDDING_FILE}")

    self.update_state(state="PROGRESS", meta={"status": "Running CryptoBench prediction"})

    # run the cryptobench model
    # TODO: fix the error handling etc
    pred = compute_prediction(EMBEDDING_FILE)

    print(f"Got prediction for {structure} from CryptoBench")
    cryptobench_prediction = [float(p) for p in pred]

    # run clustering
    clusters = compute_clusters(coordinates, cryptobench_prediction)
    clusters = [int(p) for p in clusters]

    # group residues into pockets
    pocket_groups = {}
    for i, pocket in enumerate(clusters):
        if pocket == -1:
            continue

        if pocket not in pocket_groups:
            pocket_groups[pocket] = {
                "pocket_id": pocket,
                "residue_ids": [],
                "prediction": [],
                "average_prediction": 0,
            }
        pocket_groups[pocket]["residue_ids"].append(f"{protein[i].chain_id}_{protein[i].res_id}")
        pocket_groups[pocket]["prediction"].append(cryptobench_prediction[i])

    # compute average prediction for each pocket
    for pocket in pocket_groups:
        pocket_groups[pocket]["average_prediction"] = sum(pocket_groups[pocket]["prediction"]) / len(
            pocket_groups[pocket]["prediction"]
        )

    task_data = {
        "status": "SUCCESS",
        "prediction": cryptobench_prediction,
        "clusters": clusters,
        "pockets": list(pocket_groups.values()),
        "sequence": list(seq),
        "residue_ids": [f"{residue.chain_id}_{residue.res_id}" for residue in protein],
        "input_structure": os.path.basename(STRUCTURE_FILE),
        "task_id": task_id,
    }

    # save the results to a file
    RESULTS_FILE = os.path.join(JOB_PATH, "results.json")

    with open(RESULTS_FILE, "w") as f:
        json.dump(task_data, f)

    return task_data
