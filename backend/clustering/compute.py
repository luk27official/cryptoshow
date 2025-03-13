import numpy as np
from sklearn.cluster import DBSCAN


def compute_clusters(points: list[list[float]], prediction_scores: list[float]):
    # This function computes clusters for the given points and prediction scores
    points_array = np.array(points)
    scores_array = np.array(prediction_scores).reshape(-1, 1)
    stacked = np.hstack((points_array, scores_array))  # Combine coordinates with scores

    high_score_mask = stacked[:, 3] > 0.65  # TODO: tweak this
    high_score_points = stacked[high_score_mask][:, :3]  # Extract only (x, y, z) coordinates

    eps = 5.0  # Max distance for neighbors (adjust as needed)  # TODO: tweak this
    min_samples = 3  # Minimum points to form a cluster         # TODO: tweak this
    dbscan = DBSCAN(eps=eps, min_samples=min_samples)
    labels = dbscan.fit_predict(high_score_points)

    # Initialize all labels to -1
    all_labels = -1 * np.ones(len(points), dtype=int)
    # Assign cluster labels to high score points
    all_labels[high_score_mask] = labels
    labels = all_labels

    print(labels[:10])

    return labels
