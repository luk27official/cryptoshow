import hashlib
import uuid
import os
import json

from typing import TypedDict


class FileHash(TypedDict):
    """A dictionary containing the MD5 and SHA1 hash of a file."""

    md5: str
    sha1: str


def get_file_hash(file_path: str) -> FileHash:
    """Calculate the MD5 and SHA1 hash of a file."""
    BUF_SIZE = 65536  # 64 KB

    md5 = hashlib.md5()
    sha1 = hashlib.sha1()

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
    RESULTS_PATH = os.path.join("/app/data/jobs", TASK_HASH, "results.json")

    if os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH, "r") as f:
            return json.load(f)

    return None
