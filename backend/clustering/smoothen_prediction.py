import torch
import numpy as np
import os


from .compute_distance_matrix import compute_distance_matrix_from_structure

POSITIVE_DISTANCE_THRESHOLD = 15
NEGATIVE_DISTANCE_THRESHOLD = 10
DECISION_THRESHOLD = 0.8
DROPOUT = 0.3
LAYER_WIDTH = 256
ESM2_DIM = 1280 * 2

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def process_single_sequence(
    binding_residues: list[str],
    sequence: str,
    embedding_path: str,
    structure_file_path: str,
):
    """
    Process a single sequence to extract features and labels for inference.

    Args:
        binding_residues (list[str]): List of binding residues in the format "A123" (residue type + id).
        sequence (str): Amino acid sequence of the protein.
        embedding_path (str): Path to the precomputed embedding for the given chain.
        structure_file_path (str): Path to the structure file.

    Returns:
        tuple: A tuple containing:
            - Xs (np.ndarray): Feature matrix for the residues.
            - Ys (np.ndarray): Labels for the residues (1 for positive, 0 for negative).
            - idx (np.ndarray): Indices of the residues in the sequence.
    """
    if not os.path.exists(embedding_path):
        raise FileNotFoundError(f"Embedding file for not found in {embedding_path}")

    embedding = np.load(embedding_path)
    distance_matrix = compute_distance_matrix_from_structure(structure_file_path)

    Xs = []
    Ys = []
    idx = []

    binding_residues_indices = [int(residue[1:]) for residue in binding_residues]

    negative_examples_indices = set()

    for aa, residue_idx in [(residue[0], int(residue[1:])) for residue in binding_residues]:
        assert sequence[residue_idx] == aa
        close_residues_indices = np.where(distance_matrix[residue_idx] < POSITIVE_DISTANCE_THRESHOLD)[0]
        close_binding_residues_indices = np.intersect1d(close_residues_indices, binding_residues_indices)

        concatenated_embedding = np.concatenate(
            (embedding[residue_idx], np.mean(embedding[close_binding_residues_indices], axis=0))
        )
        Xs.append(concatenated_embedding)
        Ys.append(1)  # positive example
        idx.append(residue_idx)

        really_close_residues_indices = np.where(distance_matrix[residue_idx] < NEGATIVE_DISTANCE_THRESHOLD)[0]
        negative_examples_indices.update(set(list(really_close_residues_indices)) - set(list(binding_residues_indices)))

    for residue_idx in negative_examples_indices:
        close_residues_indices = np.where(distance_matrix[residue_idx] < POSITIVE_DISTANCE_THRESHOLD)[0]
        close_binding_residues_indices = np.intersect1d(close_residues_indices, binding_residues_indices)
        concatenated_embedding = np.concatenate(
            (embedding[residue_idx], np.mean(embedding[close_binding_residues_indices], axis=0))
        )
        Xs.append(concatenated_embedding)
        Ys.append(0)
        idx.append(residue_idx)

    return np.array(Xs), np.array(Ys), np.array(idx)


def predict_single_sequence(Xs, Ys, idx, model):
    """
    Predict the binding likelihood for a single sequence using the CryptoBench model.
    Args:
        Xs (np.ndarray): Feature matrix for the residues.
        Ys (np.ndarray): Labels for the residues (1 for positive, 0 for negative).
        idx (np.ndarray): Indices of the residues in the sequence.
        model (CryptoBenchClassifier): The trained model for prediction.

    Returns:
        dict: A dictionary containing:
            - "predictions": Predicted probabilities for each residue.
            - "indices": Indices of the residues in the sequence."""

    Xs = torch.tensor(Xs, dtype=torch.float32).to(device)
    Ys = torch.tensor(Ys, dtype=torch.int64).to(device)
    idx = torch.tensor(idx, dtype=torch.int64).to(device)

    test_logits = model(Xs).squeeze()
    test_pred = torch.sigmoid(test_logits)

    return {"predictions": test_pred.detach().cpu().numpy(), "indices": idx.detach().cpu().numpy()}


class CryptoBenchClassifier(torch.nn.Module):
    def __init__(self, input_dim=ESM2_DIM):
        super().__init__()
        self.layer_1 = torch.nn.Linear(in_features=input_dim, out_features=LAYER_WIDTH)
        self.dropout1 = torch.nn.Dropout(DROPOUT)

        self.layer_2 = torch.nn.Linear(in_features=LAYER_WIDTH, out_features=LAYER_WIDTH)
        self.dropout2 = torch.nn.Dropout(DROPOUT)

        self.layer_3 = torch.nn.Linear(in_features=LAYER_WIDTH, out_features=1)

        self.relu = torch.nn.ReLU()

    def forward(self, x):
        # Intersperse the ReLU activation function between layers
        return self.layer_3(self.dropout2(self.relu(self.layer_2(self.dropout1(self.relu(self.layer_1(x)))))))
