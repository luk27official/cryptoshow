from celery import Celery
import torch
import os
import json
import shutil

import biotite.structure.io.pdbx as pdbx
import biotite.structure.io.pdb as pdb
from biotite.structure import AtomArray
from biotite.sequence import ProteinSequence

from esm2_generator import compute_esm2
from cb_small import compute_prediction
from clustering import compute_clusters
from trajectory_generator import compute_trajectory
from utils import get_file_hash
from commons import JOBS_BASE_PATH

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
def process_esm2_cryptobench(self, structure_path_original: str, structure_name: str):
    """Run ESM2 and CryptoBench models on the uploaded 3D structure.

    Parameters
    ----------
    structure_path_original : str
        Path to the uploaded structure file (or downloaded by PDB ID).
    structure_name : str
        Name of the structure (PDB ID or "custom").
    """
    if not os.path.exists(structure_path_original):
        raise FileNotFoundError(f"File {structure_path_original} not found")

    TASK_ID = self.request.id
    USED_HASH_TYPE = "md5"

    FILE_HASH = get_file_hash(structure_path_original)
    JOB_PATH = os.path.join(JOBS_BASE_PATH, FILE_HASH[USED_HASH_TYPE])

    os.makedirs(JOB_PATH, exist_ok=True)

    self.update_state(state="PROGRESS", meta={"status": "Processing the structure"})

    if structure_path_original.lower().endswith(".cif"):
        structure_file_path = os.path.join(JOB_PATH, "structure.cif")
        shutil.move(structure_path_original, structure_file_path)
        structure_file = pdbx.CIFFile.read(structure_file_path)
        protein = pdbx.get_structure(structure_file, model=1)  # type: ignore

    elif structure_path_original.lower().endswith((".pdb", ".pdb1")):
        structure_file_path = os.path.join(JOB_PATH, "structure.pdb")
        shutil.move(structure_path_original, structure_file_path)
        structure_file = pdb.PDBFile.read(structure_file_path)
        protein = pdb.get_structure(structure_file, model=1)  # type: ignore

    else:
        # This should be checked by the `main.py`, but for the sake of
        # completeness, we will raise an error here as well
        raise ValueError("Unsupported file format")

    # Remove the original folder and all its contents
    if os.path.exists(os.path.dirname(structure_path_original)):
        shutil.rmtree(os.path.dirname(structure_path_original))

    self.update_state(state="PROGRESS", meta={"status": "Extracting sequence from PDB file"})

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
    EMBEDDING_FILE = os.path.join(JOB_PATH, "embedding.npy")
    compute_esm2(SEQUENCE_FILE, EMBEDDING_FILE)

    print(f"Saved ESM2 embeddings to {EMBEDDING_FILE}")

    self.update_state(state="PROGRESS", meta={"status": "Running CryptoBench prediction"})

    # run the cryptobench model
    pred = compute_prediction(EMBEDDING_FILE)

    print(f"Got prediction for {structure_file_path} from CryptoBench")
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
        "input_structure": os.path.basename(structure_file_path),
        "task_id": TASK_ID,
        "file_hash": FILE_HASH[USED_HASH_TYPE],
        "structure_name": structure_name,
    }

    # save the results to a file
    RESULTS_FILE = os.path.join(JOB_PATH, "results.json")

    with open(RESULTS_FILE, "w") as f:
        json.dump(task_data, f)

    # zip the files to enable download
    RESULTS_ZIP_FILE = os.path.join(JOB_PATH, "results")
    temp_dir = os.path.join(JOB_PATH, "temp_for_zip")
    os.makedirs(temp_dir, exist_ok=True)

    for file in os.listdir(JOB_PATH):
        if file != "temp_for_zip" and not file.endswith(".zip"):
            src_path = os.path.join(JOB_PATH, file)
            dst_path = os.path.join(temp_dir, file)
            if os.path.isfile(src_path):
                shutil.copy2(src_path, dst_path)

    shutil.make_archive(RESULTS_ZIP_FILE, "zip", temp_dir)
    shutil.rmtree(temp_dir)

    return task_data


@celery_app.task(name="celery_app.generate_trajectory", bind=True)
def generate_trajectory(self, task_hash: str, aligned_structure_filename: str):
    """Generate a trajectory for the given aligned structure.

    Parameters
    ----------
    task_hash : str
        The hash of the task.
    aligned_structure_filename : str
        The filename of the aligned structure.
    """
    trimmed_pdb_path, trajectory_path = compute_trajectory(task_hash, aligned_structure_filename)

    # keep just the base name of the file
    trimmed_pdb_path_base = os.path.basename(trimmed_pdb_path)
    trajectory_path_base = os.path.basename(trajectory_path)

    return {"status": "SUCCESS", "trajectory": trajectory_path_base, "trimmed_pdb": trimmed_pdb_path_base}
