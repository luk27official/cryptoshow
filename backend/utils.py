import hashlib
import uuid
import os
import json
import shutil
import requests

from typing import TypedDict
import biotite.database.rcsb as rcsb
from Bio.PDB.PDBIO import Select

from commons import JOBS_BASE_PATH


class FirstModelSelect(Select):
    def accept_model(self, model):
        return model.id == 0  # BioPython uses 0-based model indices


class FileHash(TypedDict):
    """A dictionary containing the MD5 and SHA1 hash of a file."""

    md5: str
    sha1: str


def get_file_hash(file_path: str) -> FileHash:
    """Calculate the MD5 and SHA1 hash of a file.

    Args:
        file_path: The path to the file.

    Returns:
        A dictionary containing the MD5 and SHA1 hex digests
        of the file content.

    Raises:
        FileNotFoundError: If the specified file_path does not exist.
    """
    BUF_SIZE = 65536  # 64 KB

    md5 = hashlib.md5()
    sha1 = hashlib.sha1()

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(file_path, "rb") as f:
        while True:
            data = f.read(BUF_SIZE)
            if not data:
                break
            md5.update(data)
            sha1.update(data)

    return {"md5": md5.hexdigest(), "sha1": sha1.hexdigest()}


def generate_random_folder_name() -> str:
    """Generate a random folder name using UUID4.

    Returns:
        A string with a random UUID4.
    """
    return str(uuid.uuid4())


def get_existing_result(file_path: str):
    """Check if the result for a given file already exists (caching).

    It calculates the MD5 hash of the input file and looks for a
    'results.json' file within a directory named after this hash
    inside the JOBS_BASE_PATH.

    Args:
        file_path: The path to the input file for which to check
                   existing results.

    Returns:
        The loaded JSON data as a dictionary if the results file exists,
        otherwise None. Returns None if the input file doesn't exist.
    """

    try:
        FILE_HASH = get_file_hash(file_path)
    except FileNotFoundError:
        # If the input file doesn't exist, no result can exist for it.
        return None

    TASK_HASH = FILE_HASH["md5"]
    RESULTS_PATH = os.path.join(JOBS_BASE_PATH, TASK_HASH, "results.json")

    if os.path.exists(RESULTS_PATH):
        try:
            with open(RESULTS_PATH, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            # handle errors in reading the JSON file
            return None

    return None


def download_cif_file(pdb_id: str, tmp_dir: str = "") -> str:
    """Downloads a CIF file from RCSB PDB or AlphaFold database.

    If the provided `pdb_id` is 4 characters long, it attempts to download
    the corresponding structure from the RCSB PDB.
    Otherwise, it assumes the `pdb_id` is a UniProt ID and attempts to
    download the predicted structure from the AlphaFold database.

    A temporary directory is created if `tmp_dir` is not specified.
    The directory is removed if the download fails or the fetched file
    indicates an error (e.g., 404 Not Found).

    Args:
        pdb_id: The identifier for the structure. Expected to be a 4-character
            PDB ID or a UniProt ID.
        tmp_dir: The directory path where the CIF file will be saved.
            If empty or not provided, a temporary directory named with a
            random UUID will be created. Defaults to "".

    Returns:
        The absolute file path to the downloaded CIF file if successful.
        An empty string ("") if the download fails, the ID is not found,
        the fetched file content indicates an error, or any other exception occurs.
    """

    if not tmp_dir:
        tmp_dir = os.path.join(JOBS_BASE_PATH, generate_random_folder_name())
        os.makedirs(tmp_dir, exist_ok=True)

    cif_file_path = ""

    try:
        if len(pdb_id) == 4:
            cif_file_path: str = rcsb.fetch(pdb_id, "cif", tmp_dir)  # type: ignore
            with open(cif_file_path, "r") as f:
                cif_file_content = f
                if "400 Bad Request" in cif_file_content.read() or "404 Not Found" in cif_file_content.read():
                    shutil.rmtree(tmp_dir)
                    return ""

            return cif_file_path

        uniprot_id = pdb_id
        cif_file_path = os.path.join(tmp_dir, f"{uniprot_id}.cif")
        # Assuming pdb_id is a UniProt ID if not 4 characters, try the AlphaFill database
        # disabled for now...
        # alphafill_url = f"https://alphafill.eu/v1/aff/{uniprot_id}"

        # response = requests.get(alphafill_url)
        # if response.status_code == 200:
        #     with open(cif_file_path, "wb") as f:
        #         for chunk in response.iter_content(chunk_size=8192):
        #             f.write(chunk)
        #     return cif_file_path

        # If AlphaFill doesn't have the file, try AlphaFold
        alphafold_url = f"https://alphafold.ebi.ac.uk/files/AF-{uniprot_id}-F1-model_v4.cif"
        cif_file_path = os.path.join(tmp_dir, f"{uniprot_id}.cif")

        response = requests.get(alphafold_url, stream=True)
        if response.status_code == 200:
            with open(cif_file_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return cif_file_path
        else:
            shutil.rmtree(tmp_dir)
            return ""

    except Exception as e:
        shutil.rmtree(tmp_dir)
        return ""
