import hashlib
import uuid
import os
import json
import shutil

from typing import TypedDict
import biotite.database.rcsb as rcsb

from commons import JOBS_BASE_PATH


class FileHash(TypedDict):
    """A dictionary containing the MD5 and SHA1 hash of a file."""

    md5: str
    sha1: str


def get_file_hash(file_path: str) -> FileHash:
    """Calculate the MD5 and SHA1 hash of a file."""
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


def generate_random_folder_name():
    """Generate a random folder name."""
    return str(uuid.uuid4())


def get_existing_result(file_path: str):
    """Check if the result for a given file already exists (caching)."""
    FILE_HASH = get_file_hash(file_path)
    TASK_HASH = FILE_HASH["md5"]
    RESULTS_PATH = os.path.join(JOBS_BASE_PATH, TASK_HASH, "results.json")

    if os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH, "r") as f:
            return json.load(f)

    return None


def download_cif_file(pdb_id: str):
    """Download a CIF file from the RCSB database."""
    tmp_dir = os.path.join(JOBS_BASE_PATH, generate_random_folder_name())
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        cif_file_path: str = rcsb.fetch(pdb_id, "cif", tmp_dir)  # type: ignore
        with open(cif_file_path, "r") as f:
            cif_file_content = f
            if "400 Bad Request" in cif_file_content.read() or "404 Not Found" in cif_file_content.read():
                shutil.rmtree(tmp_dir)
                return ""

    except Exception as e:
        shutil.rmtree(tmp_dir)
        return ""

    return cif_file_path
