import MDAnalysis as mda
from MDAnalysis.coordinates.XTC import XTCWriter
from MDAnalysis.core.groups import AtomGroup, Atom, Residue

import os
import json
import numpy as np
import gemmi

from scipy.interpolate import CubicSpline
from typing import List, Tuple

from commons import JOBS_BASE_PATH

protein_letters_3to1 = {
    "ALA": "A",
    "CYS": "C",
    "ASP": "D",
    "GLU": "E",
    "PHE": "F",
    "GLY": "G",
    "HIS": "H",
    "ILE": "I",
    "LYS": "K",
    "LEU": "L",
    "MET": "M",
    "ASN": "N",
    "PRO": "P",
    "GLN": "Q",
    "ARG": "R",
    "SER": "S",
    "THR": "T",
    "VAL": "V",
    "TRP": "W",
    "TYR": "Y",
}


def convert_cif_to_pdb(cif_path: str, pdb_path: str) -> None:
    """Convert CIF files to PDB format."""
    structure = gemmi.read_structure(cif_path)
    structure.remove_alternative_conformations()
    structure.write_pdb(pdb_path)


def get_sequence_and_residues(universe: mda.Universe) -> Tuple[str, List[Residue]]:
    """Extracts the sequence and valid residues from a protein universe."""
    # TODO: what does this do with ligands?
    residues: AtomGroup = universe.select_atoms("protein").residues
    seq: str = ""
    valid_res: List[Residue] = []
    for res in residues:
        try:
            aa: str = protein_letters_3to1[res.resname.upper()]
            seq += aa
            valid_res.append(res)
        except KeyError:
            print(f"Unknown residue: {res.resname} at {res.resid}")
            continue  # skip unknown residues
    return seq, valid_res


def longest_common_substring(s1: str, s2: str) -> str:
    """Finds the longest common substring of two strings."""
    m: List[List[int]] = [[0] * (1 + len(s2)) for i in range(1 + len(s1))]
    longest: int = 0
    x_longest: int = 0
    for x in range(1, 1 + len(s1)):
        for y in range(1, 1 + len(s2)):
            if s1[x - 1] == s2[y - 1]:
                m[x][y] = m[x - 1][y - 1] + 1
                if m[x][y] > longest:
                    longest = m[x][y]
                    x_longest = x
            else:
                m[x][y] = 0
    start: int = x_longest - longest
    return s1[start:x_longest]


def compute_trajectory(task_hash: str, aligned_structure_filename: str) -> Tuple[str, str]:
    """Main function to compute the trajectory."""

    RESULT_FILE: str = os.path.join(JOBS_BASE_PATH, task_hash, "results.json")

    # Open the result file and get the "input_structure" field
    if not os.path.exists(RESULT_FILE):
        raise FileNotFoundError(f"Result file {RESULT_FILE} not found.")

    with open(RESULT_FILE, "r") as f:
        result_data = json.load(f)
        input_structure: str = result_data.get("input_structure")
        if not input_structure:
            raise ValueError("No input structure found in the result file.")

    STRUCTURE_FILE: str = os.path.join(JOBS_BASE_PATH, task_hash, input_structure)
    ALIGNED_STRUCTURE_FILE: str = os.path.join(JOBS_BASE_PATH, task_hash, aligned_structure_filename)

    if not os.path.exists(STRUCTURE_FILE) or not os.path.exists(ALIGNED_STRUCTURE_FILE):
        raise FileNotFoundError(f"Structure files {STRUCTURE_FILE} or {ALIGNED_STRUCTURE_FILE} not found.")

    pdb_file: str = STRUCTURE_FILE
    aligned_pdb_file: str = ALIGNED_STRUCTURE_FILE

    if STRUCTURE_FILE.endswith(".cif"):
        pdb_file = STRUCTURE_FILE.replace(".cif", ".pdb")
        if not os.path.exists(pdb_file):
            convert_cif_to_pdb(STRUCTURE_FILE, pdb_file)

    if ALIGNED_STRUCTURE_FILE.endswith(".cif"):
        aligned_pdb_file = ALIGNED_STRUCTURE_FILE.replace(".cif", ".pdb")
        if not os.path.exists(aligned_pdb_file):
            convert_cif_to_pdb(ALIGNED_STRUCTURE_FILE, aligned_pdb_file)

    u1: mda.Universe = mda.Universe(aligned_pdb_file)
    u2: mda.Universe = mda.Universe(pdb_file)

    seq1: str
    res1: List[Residue]
    seq2: str
    res2: List[Residue]
    seq1, res1 = get_sequence_and_residues(u1)
    seq2, res2 = get_sequence_and_residues(u2)

    # we do NOT need alignment here, because we only need to animate the LCS...
    # e.g. we could not align T-VALYDYESRT with TFVALYDYESRT because there is a gap
    # and we need animation between exact residues
    lcs: str = longest_common_substring(seq1, seq2)

    start_index_seq1: int = seq1.find(lcs)
    start_index_seq2: int = seq2.find(lcs)

    trimmed_res1: List[Residue] = res1[start_index_seq1 : start_index_seq1 + len(lcs)]
    trimmed_res2: List[Residue] = res2[start_index_seq2 : start_index_seq2 + len(lcs)]

    assert len(trimmed_res1) == len(trimmed_res2), "Mismatch in number of residues!"

    atoms1: List[Atom] = []
    atoms2: List[Atom] = []

    # Extract atoms from the trimmed residues
    for r1, r2 in zip(trimmed_res1, trimmed_res2):
        a1_dict = {a.name: a for a in r1.atoms}
        a2_dict = {a.name: a for a in r2.atoms}
        for name in a1_dict.keys() & a2_dict.keys():
            atoms1.append(a1_dict[name])
            atoms2.append(a2_dict[name])

    assert len(atoms1) == len(atoms2), "Mismatch in number of atoms!"
    assert len(atoms1) > 0, "No common atoms found!"

    # Interpolation
    n_frames: int = 50
    ag1: AtomGroup = atoms1[0].universe.atoms[[atom.index for atom in atoms1]]
    ag2: AtomGroup = atoms2[0].universe.atoms[[atom.index for atom in atoms2]]

    # Save the trimmed structure
    TRIMMED_PDB_FILE: str = os.path.join(
        JOBS_BASE_PATH, task_hash, f"anim_{os.path.splitext(os.path.basename(aligned_structure_filename))[0]}.pdb"
    )

    with mda.Writer(TRIMMED_PDB_FILE, n_atoms=len(ag2)) as pdb_writer:
        pdb_writer.write(ag2)

    positions1: np.ndarray = ag1.positions  # Starting positions (frame 1)
    positions2: np.ndarray = ag2.positions  # Ending positions (frame n + 1)

    n_atoms: int = len(ag1)
    splines: List[CubicSpline] = []
    for i in range(3):  # for each axis (x, y, z)
        # create a spline for each axis using the positions from both frames
        spline: CubicSpline = CubicSpline([0, 1], np.array([positions1[:, i], positions2[:, i]]))
        splines.append(spline)

    TRAJECTORY_FILE: str = os.path.join(
        JOBS_BASE_PATH,
        task_hash,
        f"anim_{os.path.splitext(os.path.basename(aligned_structure_filename))[0]}.xtc",
    )

    with XTCWriter(TRAJECTORY_FILE, n_atoms=n_atoms) as writer:
        for i in range(n_frames + 1):
            alpha: float = i / n_frames

            # apply spline interpolation for each axis
            interpolated_positions: np.ndarray = np.column_stack([spline(alpha) for spline in splines])

            ag1.positions = interpolated_positions
            writer.write(ag1)

    return TRIMMED_PDB_FILE, TRAJECTORY_FILE
