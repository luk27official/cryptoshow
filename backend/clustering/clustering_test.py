import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.colors import ListedColormap

"""This script generates random 3D points with scores, filters high-score points,
and applies DBSCAN clustering to visualize the clusters in 3D space."""

np.random.seed(42)
num_points = 200
xyz = np.random.uniform(0, 20, size=(num_points, 3))  # Random coordinates in range [0, 20]
scores = np.random.uniform(0, 1, size=(num_points, 1))  # Scores in range [0, 1]
points = np.hstack((xyz, scores))  # Combine coordinates with scores

high_score_mask = points[:, 3] > 0.75
high_score_points = points[high_score_mask][:, :3]  # Extract only (x, y, z) coordinates

# Perform the clustering
eps = 5.0  # Max distance for neighbors (adjust as needed)
min_samples = 3  # Minimum points to form a cluster
dbscan = DBSCAN(eps=eps, min_samples=min_samples)
labels = dbscan.fit_predict(high_score_points)

distinct_colors = ListedColormap(["red", "blue", "green", "purple", "orange", "cyan", "magenta", "brown", "pink"])

unique_labels = set(labels)

fig = plt.figure(figsize=(8, 6))
ax = fig.add_subplot(111, projection="3d")

# Plot all points (including low-score ones) in gray
ax.scatter(
    points[:, 0], points[:, 1], points[:, 2], color="lightgray", label="All Points (Not Clustered)", s=20, alpha=0.5
)

# Plot clustered high-score points
for i, label in enumerate(unique_labels):
    cluster_points = high_score_points[labels == label]
    color = "black" if label == -1 else distinct_colors(i % distinct_colors.N)
    label_name = "Noise" if label == -1 else f"Cluster {label}"

    ax.scatter(
        cluster_points[:, 0],
        cluster_points[:, 1],
        cluster_points[:, 2],
        color=color,
        label=label_name,
        s=50,
        edgecolors="k",
    )

ax.set_xlabel("X")
ax.set_ylabel("Y")
ax.set_zlabel("Z")
ax.set_title("3D Clustering with DBSCAN (High-Score Points Clustered)")
ax.legend()
plt.show()
