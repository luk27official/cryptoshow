import biotite.structure.io.pdbx as pdbx
import biotite.structure.io.pdb as pdb
from biotite.structure import AtomArray
import numpy as np
import os


def compute_distance_matrix_from_structure(structure_file_path: str):
    # for every two residues in the structure, compute the distance between them
    if not os.path.exists(structure_file_path):
        raise FileNotFoundError(f"Structure file {structure_file_path} does not exist.")

    if structure_file_path.endswith(".cif"):
        sf = pdbx.CIFFile.read(structure_file_path)
        protein = pdbx.get_structure(sf, model=1)  # type: ignore
    elif structure_file_path.endswith(".pdb") or structure_file_path.endswith(".pdb1"):
        sf = pdb.PDBFile.read(structure_file_path)
        protein = pdb.get_structure(sf, model=1)  # type: ignore

    protein: AtomArray = protein[(protein.atom_name == "CA") & (protein.element == "C")]  # type: ignore

    coordinates = []

    for residue in protein:
        coordinates.append(residue.coord)

    coordinates = np.array(coordinates)
    distance_matrix = np.linalg.norm(coordinates[:, np.newaxis] - coordinates[np.newaxis, :], axis=-1)

    return distance_matrix
