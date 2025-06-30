from celery import Celery
import torch
import os
import json
import shutil
from collections import defaultdict

import biotite.structure.io.pdbx as pdbx
import biotite.structure.io.pdb as pdb
from biotite.structure import AtomArray
from biotite.sequence import ProteinSequence

from Bio.PDB.MMCIFParser import MMCIFParser
from Bio.PDB.mmcifio import MMCIFIO
from Bio.PDB.PDBParser import PDBParser
from Bio.PDB.PDBIO import PDBIO

from prediction import compute_prediction
from clustering import compute_clusters, refine_clusters
from trajectory_generator import compute_trajectory
from utils import get_file_hash, FirstModelSelect
from commons import JOBS_BASE_PATH

celery_app = Celery(
    "celery_app",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
    broker_connection_retry_on_startup=True,
    result_expires=0,
    worker_send_task_events=True,
    task_send_sent_event=True,
)


@celery_app.task(name="celery_app.cuda_test", bind=True)
def process_string_test(self):
    """CUDA availability test.

    Returns:
        dict: A dictionary indicating the device used ('cuda' or 'cpu').
    """
    return {"device": "cuda" if torch.cuda.is_available() else "cpu"}


@celery_app.task(name="celery_app.process_esm2_cryptobench", bind=True)
def process_esm2_cryptobench(self, structure_path_original: str, structure_name: str):
    """Runs the CryptoBench model on a 3D structure.

    Processes an uploaded or downloaded protein structure file (PDB or CIF),
    extracts its sequence and coordinates, runs CryptoBench prediction,
    performs clustering, and saves the results.

    Args:
        structure_path_original (str): Path to the input structure file
            (PDB or CIF format).
        structure_name (str): Name of the structure (e.g., PDB ID or "custom").

    Returns:
        dict: A dictionary containing the processing results.

    Raises:
        FileNotFoundError: If the input structure file does not exist.
        ValueError: If the input file format is unsupported.
    """

    if not os.path.exists(structure_path_original):
        raise FileNotFoundError(f"File {structure_path_original} not found")

    TASK_ID = self.request.id
    USED_HASH_TYPE = "md5"

    FILE_HASH = get_file_hash(structure_path_original)
    TASK_FALLBACK_PATH = os.path.join(JOBS_BASE_PATH, TASK_ID)
    JOB_PATH = os.path.join(JOBS_BASE_PATH, FILE_HASH[USED_HASH_TYPE])

    os.makedirs(JOB_PATH, exist_ok=True)

    self.update_state(state="PROGRESS", meta={"status": "Processing the structure"})

    if structure_path_original.lower().endswith(".cif"):
        structure_file_path = os.path.join(JOB_PATH, "structure.cif")

        # Keep just the first model in the file
        parser = MMCIFParser(QUIET=True)
        structure = parser.get_structure("protein", structure_path_original)

        io = MMCIFIO()
        io.set_structure(structure)
        io.save(structure_file_path, select=FirstModelSelect())

        # Extract header information from the original file
        header_lines = []
        with open(structure_path_original, "r") as f:
            for line in f:
                if line.startswith(("_entry.id")):
                    header_lines.append(line)

        with open(structure_file_path, "r") as f:
            content = f.readlines()

        with open(structure_file_path, "w") as f:
            f.write("data_protein\n")
            for line in header_lines:
                f.write(line)
            # Skip the first line of content (data_protein)
            f.writelines(content[1:])

        structure_file = pdbx.CIFFile.read(structure_file_path)
        protein = pdbx.get_structure(structure_file, model=1)  # type: ignore

    elif structure_path_original.lower().endswith((".pdb", ".pdb1")):
        structure_file_path = os.path.join(JOB_PATH, "structure.pdb")
        # Keep just the first model in the file
        parser = PDBParser(QUIET=True)
        structure = parser.get_structure("protein", structure_path_original)

        io = PDBIO()
        io.set_structure(structure)
        io.save(structure_file_path, select=FirstModelSelect())

        # Extract header information from the original file
        header_lines = []
        with open(structure_path_original, "r") as f:
            for line in f:
                if line.startswith(("HEADER", "TITLE", "COMPND", "SOURCE")):
                    header_lines.append(line)

        with open(structure_file_path, "r") as f:
            content = f.read()

        with open(structure_file_path, "w") as f:
            for line in header_lines:
                f.write(line)
            f.write(content)

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

    sequences_by_chain = defaultdict(list)

    for residue in protein:
        chain_id = residue.chain_id
        one_letter = (
            ProteinSequence.convert_letter_3to1(residue.res_name)
            if residue.res_name in ProteinSequence._dict_3to1
            else "X"
        )
        sequences_by_chain[chain_id].append(one_letter)

    sequences_by_chain = {chain: "".join(seq) for chain, seq in sequences_by_chain.items()}

    coordinates = []
    cryptobench_prediction = []
    seq = []
    sequence_files = []

    for chain, sequence in sequences_by_chain.items():
        SEQUENCE_FILE = os.path.join(JOB_PATH, f"seq_{chain}.fasta")

        with open(SEQUENCE_FILE, "w") as f:
            f.write(f"{sequence}")

        sequence_files.append(SEQUENCE_FILE)

        print(f"Saved sequence file for chain {chain} to {SEQUENCE_FILE}")

    for chain, sequence in sequences_by_chain.items():
        SEQUENCE_FILE = os.path.join(JOB_PATH, f"seq_{chain}.fasta")

        self.update_state(state="PROGRESS", meta={"status": f"Running CryptoBench prediction for chain {chain}"})

        # run the cryptobench model for this chain
        with open(SEQUENCE_FILE, "r") as f:
            sequence_content = f.read().strip()

        if not sequence_content:
            raise ValueError(f"Empty sequence for chain {chain} in file {SEQUENCE_FILE}")

        chain_pred = compute_prediction(sequence_content, JOB_PATH, chain)
        print(f"Got prediction for chain {chain} from CryptoBench")

        chain_residues = [r for r in protein if r.chain_id == chain]
        seq.extend(list(sequence))

        for residue in chain_residues:
            coordinates.append(residue.coord)

        cryptobench_prediction.extend([float(p) for p in chain_pred])

    coordinates = [[float(c) for c in coord] for coord in coordinates]
    print(f"Extracted 3D coordinates for all chains")

    # run clustering
    clusters = compute_clusters(coordinates, cryptobench_prediction)
    clusters = [int(p) for p in clusters]

    # refine clusters by using smoothing model
    self.update_state(state="PROGRESS", meta={"status": "Refining clusters"})
    clusters = refine_clusters(clusters, coordinates, JOB_PATH, structure_file_path, sequences_by_chain)

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

    # region Reassign
    # after computing the average prediction, sort the pocket groups by the average prediction
    # and reassign the numbers starting by 1... this is the logic
    sorted_pockets = sorted(pocket_groups.values(), key=lambda x: x["average_prediction"], reverse=True)

    # create a new pocket_groups dictionary with reassigned IDs
    pocket_groups = {}
    for new_id, pocket in enumerate(sorted_pockets, 1):
        pocket["pocket_id"] = new_id
        pocket_groups[new_id] = pocket

    # update cluster IDs to match the new pocket numbering
    id_mapping = {-1: -1}  # keep -1 as is (non-clustered residues)
    for new_id, pocket in pocket_groups.items():
        for res_id in pocket["residue_ids"]:
            # find the residue index in the protein array
            for i, residue in enumerate(protein):
                if f"{residue.chain_id}_{residue.res_id}" == res_id:
                    # map the old cluster ID to the new one
                    if clusters[i] not in id_mapping:
                        id_mapping[clusters[i]] = new_id
                    break

    clusters = [id_mapping.get(c, c) for c in clusters]
    # endregion

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

    # save the results to a fallback file as well - if Celery losts the task name...
    os.makedirs(TASK_FALLBACK_PATH, exist_ok=True)
    RESULTS_FALLBACK_FILE = os.path.join(TASK_FALLBACK_PATH, "results.json")

    with open(RESULTS_FALLBACK_FILE, "w") as f:
        json.dump(task_data, f)

    # remove all *.npy files from the job path (embeddings)
    for file in os.listdir(JOB_PATH):
        if file.endswith(".npy"):
            os.remove(os.path.join(JOB_PATH, file))

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
def generate_trajectory(self, task_hash: str, aligned_structure_filename: str, target_chains: str):
    """Generates a trajectory for a given aligned structure.

    Args:
        task_hash (str): The hash identifier of the associated task.
        aligned_structure_filename (str): The filename of the aligned
            protein structure.
        target_chains (str): The target chains for the trajectory.
            (e.g., "A,B,C" for chains A, B, and C).

    Returns:
        dict: A dictionary containing the status and the base filenames of
            the generated trajectory and trimmed PDB files.
    """
    trimmed_pdb_path, trajectory_path = compute_trajectory(task_hash, aligned_structure_filename, target_chains)

    # keep just the base name of the file
    trimmed_pdb_path_base = os.path.basename(trimmed_pdb_path)
    trajectory_path_base = os.path.basename(trajectory_path)

    return {"status": "SUCCESS", "trajectory": trajectory_path_base, "trimmed_pdb": trimmed_pdb_path_base}
