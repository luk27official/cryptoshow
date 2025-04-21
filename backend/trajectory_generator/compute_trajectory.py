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

    universe_aligned: mda.Universe = mda.Universe(aligned_pdb_file)
    universe_original: mda.Universe = mda.Universe(pdb_file)

    seq_aligned, res_aligned = get_sequence_and_residues(universe_aligned)
    seq_original, res_original = get_sequence_and_residues(universe_original)

    # we do NOT need alignment here, because we only need to animate the LCS...
    # e.g. we could not align T-VALYDYESRT with TFVALYDYESRT because there is a gap
    # and we need animation between exact residues
    lcs: str = longest_common_substring(seq_aligned, seq_original)

    start_index_seq_aligned: int = seq_aligned.find(lcs)
    start_index_seq_original: int = seq_original.find(lcs)

    trimmed_res_aligned: List[Residue] = res_aligned[start_index_seq_aligned : start_index_seq_aligned + len(lcs)]
    trimmed_res_original: List[Residue] = res_original[start_index_seq_original : start_index_seq_original + len(lcs)]

    assert len(trimmed_res_aligned) == len(trimmed_res_original), "Mismatch in number of residues!"

    atoms_aligned: List[Atom] = []
    atoms_original: List[Atom] = []

    # Extract atoms from the trimmed residues
    for res_aligned, res_original in zip(trimmed_res_aligned, trimmed_res_original):
        a1_dict = {a.name: a for a in res_aligned.atoms}
        a2_dict = {a.name: a for a in res_original.atoms}
        for name in a1_dict.keys() & a2_dict.keys():
            atoms_aligned.append(a1_dict[name])
            atoms_original.append(a2_dict[name])

    assert len(atoms_aligned) == len(atoms_original), "Mismatch in number of atoms!"
    assert len(atoms_aligned) > 0, "No common atoms found!"

    # Interpolation
    n_frames: int = 50
    atom_group_aligned: AtomGroup = atoms_aligned[0].universe.atoms[[atom.index for atom in atoms_aligned]]
    atom_group_original: AtomGroup = atoms_original[0].universe.atoms[[atom.index for atom in atoms_original]]

    # Get ligands from the aligned universe
    ligands_aligned: AtomGroup = universe_aligned.select_atoms("not protein and not resname HOH")
    for atom in ligands_aligned.atoms:
        atom.segment.segid = "LG"  # segid is used for chain identifiers in PDB files

    # Append the ligands to both atom groups
    atom_group_aligned = atom_group_aligned + ligands_aligned

    u_new = mda.Merge(atom_group_original, ligands_aligned)
    atom_group_original = u_new.select_atoms("all")

    # Save the trimmed structure
    TRIMMED_PDB_FILE: str = os.path.join(
        JOBS_BASE_PATH, task_hash, f"anim_{os.path.splitext(os.path.basename(aligned_structure_filename))[0]}.pdb"
    )

    with mda.Writer(TRIMMED_PDB_FILE, n_atoms=len(atom_group_original)) as pdb_writer:
        pdb_writer.write(atom_group_original)

    positions_aligned: np.ndarray = atom_group_aligned.positions  # Starting positions (frame 1)
    positions_original: np.ndarray = atom_group_original.positions  # Ending positions (frame n + 1)

    n_atoms: int = len(atom_group_aligned)
    splines: List[CubicSpline] = []
    for i in range(3):  # for each axis (x, y, z)
        # create a spline for each axis using the positions from both frames
        spline: CubicSpline = CubicSpline([0, 1], np.array([positions_aligned[:, i], positions_original[:, i]]))
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

            atom_group_aligned.positions = interpolated_positions
            writer.write(atom_group_aligned)

    return TRIMMED_PDB_FILE, TRAJECTORY_FILE
