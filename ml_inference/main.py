from fastapi import FastAPI
from fastapi.logger import logger
import uvicorn
import logging

# TODO: this is here for debugging when behind a proxy !!!
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
# TODO remove

import biotite.database.rcsb as rcsb
import biotite.structure.io.pdbx as pdbx
from biotite.structure.io.pdbx import get_structure
from biotite.sequence import ProteinSequence


from .esm2_generator import compute_esm2
from .cb import compute_prediction2

app = FastAPI()
uvicorn_logger = logging.getLogger("uvicorn.error")
logger.handlers = uvicorn_logger.handlers
logger.setLevel(logging.DEBUG)


@app.get("/")
async def read_root():
    return {"Hello": "World from the ML-api"}


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
    try:
        compute_esm2(f"/app/data/inputs/{pdb_id}.fasta", f"/app/data/outputs/{pdb_id}.npy")
    except Exception as e:
        logger.error(f"Error running ESM2 model: {e}")
        return {"error": str(e)}

    print(f"Saved ESM2 embeddings to /app/data/outputs/{pdb_id}.npy")

    # run the cryptobench model
    try:
        pred = compute_prediction2(f"/app/data/outputs/{pdb_id}.npy")
    except Exception as e:
        logger.error(f"Error running ESM2 model: {e}")
        return {"error": str(e)}

    print(f"Prediction: {pred}")

    return {
        "status": f"Prediction run succesfully for {pdb_id}. Available at /app/data/outputs/{pdb_id}.npy",
        "prediction": pred[1],
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6000, log_level="trace", reload=True, debug=True, proxy_headers=True)
