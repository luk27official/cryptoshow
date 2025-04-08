import MDAnalysis as mda
from MDAnalysis.coordinates.XTC import XTCWriter

import numpy as np
import gemmi

from scipy.interpolate import CubicSpline

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


def convert_cif_to_pdb(cif_path: str, pdb_path: str):
    """Used to convert CIF files to PDB format."""
    structure = gemmi.read_structure(cif_path)
    structure.remove_alternative_conformations()
    structure.write_pdb(pdb_path)


convert_cif_to_pdb("cndt_2h8hA_aligned_to_2srcA.cif", "aligned.pdb")
convert_cif_to_pdb("2src.cif", "2src.pdb")

u1 = mda.Universe("aligned.pdb")
u2 = mda.Universe("2src.pdb")  # reference


def get_sequence_and_residues(universe):
    """Extracts the sequence and valid residues from a protein universe."""
    residues = universe.select_atoms("protein").residues
    seq = ""
    valid_res = []
    for res in residues:
        try:
            aa = protein_letters_3to1[res.resname.upper()]
            seq += aa
            valid_res.append(res)
        except KeyError:
            print(f"Unknown residue: {res.resname} at {res.resid}")
            continue  # skip unknown residues
    return seq, valid_res


seq1, res1 = get_sequence_and_residues(u1)
seq2, res2 = get_sequence_and_residues(u2)

# we do NOT need alignment here, because we only need to animate the LCS...
# e.g. we could not align T-VALYDYESRT with TFVALYDYESRT because there is a gap


def longest_common_substring(s1, s2):
    """Finds the longest common substring of two strings."""
    m = [[0] * (1 + len(s2)) for i in range(1 + len(s1))]
    longest, x_longest = 0, 0
    for x in range(1, 1 + len(s1)):
        for y in range(1, 1 + len(s2)):
            if s1[x - 1] == s2[y - 1]:
                m[x][y] = m[x - 1][y - 1] + 1
                if m[x][y] > longest:
                    longest = m[x][y]
                    x_longest = x
            else:
                m[x][y] = 0
    start = x_longest - longest
    return s1[start:x_longest]


lcs = longest_common_substring(seq1, seq2)

start_index_seq1 = seq1.find(lcs)
start_index_seq2 = seq2.find(lcs)

trimmed_res1 = res1[start_index_seq1 : start_index_seq1 + len(lcs)]
trimmed_res2 = res2[start_index_seq2 : start_index_seq2 + len(lcs)]

atoms1 = []
atoms2 = []

assert len(trimmed_res1) == len(trimmed_res2), "Mismatch in number of residues!"

for r1, r2 in zip(trimmed_res1, trimmed_res2):
    a1_dict = {a.name: a for a in r1.atoms}
    a2_dict = {a.name: a for a in r2.atoms}
    for name in a1_dict.keys() & a2_dict.keys():
        atoms1.append(a1_dict[name])
        atoms2.append(a2_dict[name])

if not atoms1 or not atoms2:
    raise ValueError("No matching atoms found in aligned residues!")

assert len(atoms1) == len(atoms2), "Mismatch in number of atoms!"

# interpolation
n_frames = 50
ag1 = atoms1[0].universe.atoms[[atom.index for atom in atoms1]]
ag2 = atoms2[0].universe.atoms[[atom.index for atom in atoms2]]

# save the trimmed structure
with mda.Writer("trimmed_structure.pdb", n_atoms=len(ag1)) as pdb_writer:
    pdb_writer.write(ag1)

positions1 = ag1.positions  # Starting positions (frame 1)
positions2 = ag2.positions  # Ending positions (frame n + 1)

n_atoms = len(ag1)
splines = []
for i in range(3):  # for each axis (x, y, z)
    # create a spline for each axis using the positions from both frames
    spline = CubicSpline([0, 1], np.array([positions1[:, i], positions2[:, i]]))
    splines.append(spline)

with XTCWriter("interpolated_trajectory_spline.xtc", n_atoms=n_atoms) as writer:
    for i in range(n_frames + 1):
        alpha = i / n_frames

        # apply spline interpolation for each axis
        interpolated_positions = np.column_stack([spline(alpha) for spline in splines])

        ag1.positions = interpolated_positions
        writer.write(ag1)

print(f"Successfully wrote interpolated trajectory to 'interpolated_trajectory_spline.xtc'")
