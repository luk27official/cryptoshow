import numpy as np
import torch
import os

from sklearn.cluster import DBSCAN

from .smoothen_prediction import process_single_sequence, predict_single_sequence, CryptoBenchClassifier

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_STATE_DICT_PATH = "/app/cryptobench-small/smoothening_model-650M-finetuned.pt"


def compute_clusters(
    points: list[list[float]],
    prediction_scores: list[float],
):
    """
    Compute clusters based on the given points and prediction scores.

    Args:
        points (list[list[float]]): A list of points, where each point is a list of 3 coordinates [x, y, z].
        prediction_scores (list[float]): A list of prediction scores corresponding to each point.

    Returns:
        np.ndarray: An array of cluster labels for each point. Points with no cluster are labeled as -1.
    """

    points_array = np.array(points)
    scores_array = np.array(prediction_scores).reshape(-1, 1)
    stacked = np.hstack((points_array, scores_array))  # Combine coordinates with scores

    HIGH_SCORE_THRESHOLD = 0.7  # Threshold to consider a point as high score

    high_score_mask = stacked[:, 3] > HIGH_SCORE_THRESHOLD
    high_score_points = stacked[high_score_mask][:, :3]  # Extract only (x, y, z) coordinates

    EPS = 5.0  # Max distance for neighbors
    MIN_SAMPLES = 3  # Min points to form a cluster

    # No pockets can be formed if there are not enough high score points.
    if len(high_score_points) < MIN_SAMPLES:
        return -1 * np.ones(len(points), dtype=int)

    dbscan = DBSCAN(eps=EPS, min_samples=MIN_SAMPLES)
    labels = dbscan.fit_predict(high_score_points)

    # Initialize all labels to -1
    all_labels = -1 * np.ones(len(points), dtype=int)
    # Assign cluster labels to high score points
    all_labels[high_score_mask] = labels
    labels = all_labels

    return labels


def refine_clusters(
    clusters: list[int],
    points: list[list[float]],
    embedding_path_directory: str,
    structure_file_path: str,
    sequences_by_chain: dict[str, str],
):
    """
    Refine the clusters by applying a machine learning model to smoothen the predictions.

    Args:
        clusters (list[int]): List of cluster labels for each point.
        points (list[list[float]]): List of points, where each point is a list of 3 coordinates [x, y, z].
        embedding_path_directory (str): Directory path where embeddings are stored.
        structure_file_path (str): Path to the structure file.
        sequences_by_chain (dict[str, str]): Dictionary mapping chain identifiers to their sequences.

    Returns:
        list[int]: Refined cluster labels for each point."""

    points_array = np.array(points)
    clusters_new = []
    processed_residues = 0

    for chain, sequence in sequences_by_chain.items():
        print(f"Refining clusters for sequence: {sequence} and chain: {chain}")

        clusters_chain = clusters[processed_residues : processed_residues + len(sequence)]
        points_chain = points_array[processed_residues : processed_residues + len(sequence)]
        processed_residues += len(sequence)

        for cluster_label in np.unique(clusters_chain):
            if cluster_label == -1:
                continue

            cluster_points = points_chain[clusters_chain == cluster_label]
            print(f"Processing cluster {cluster_label} with {len(cluster_points)} points.")

            model = CryptoBenchClassifier().to(DEVICE)
            model.load_state_dict(torch.load(MODEL_STATE_DICT_PATH, map_location=DEVICE), strict=True)

            cluster_indices = np.where(clusters_chain == cluster_label)[0]

            binding_residues = [f"{sequence[idx]}{idx}" for idx in cluster_indices]  # Format: residue_type + position

            embedding_file_path = os.path.join(embedding_path_directory, f"embedding_{chain}.npy")

            single_for_prediction = process_single_sequence(
                binding_residues,
                sequence,
                embedding_file_path,
                structure_file_path,
            )

            smoothened_prediction = predict_single_sequence(*single_for_prediction, model=model)

            SMOOTHENED_THRESHOLD = (
                0.7  # this is defined by the training data - best F1 score was achieved with this threshold
            )

            selected_indices = np.where(smoothened_prediction["predictions"] > SMOOTHENED_THRESHOLD)[0]
            selected_indices_mapped = smoothened_prediction["indices"][selected_indices]

            for idx in selected_indices_mapped:
                clusters_chain[idx] = cluster_label

        clusters_new.extend(clusters_chain)

    return clusters_new
