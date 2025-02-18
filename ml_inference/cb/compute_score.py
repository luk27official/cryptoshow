import numpy as np
import sys
import os
from tensorflow import keras

# CAUTION: You need to specify the path to the CryptoBench dataset! It is available at: https://osf.io/pz4a9/
CRYPTOBENCH_PATH = "/app/cryptobench"
sys.path.append(f"{CRYPTOBENCH_PATH}/scripts")

# 0.95 decision threshold was used in the CryptoBench paper
MODEL_PATH = f"{CRYPTOBENCH_PATH}/benchmark/best_trained"
DECISION_THRESHOLD = 0.95


class MatthewsCorrelationCoefficient(keras.metrics.Metric):
    def __init__(self, name="mcc", **kwargs):
        super().__init__(name=name, **kwargs)
        self.tp = self.add_weight(name="tp", initializer="zeros")
        self.tn = self.add_weight(name="tn", initializer="zeros")
        self.fp = self.add_weight(name="fp", initializer="zeros")
        self.fn = self.add_weight(name="fn", initializer="zeros")

    def update_state(self, y_true, y_pred, sample_weight=None):
        y_pred = np.where(y_pred > 0.5, 1, 0)  # Threshold at 0.5
        y_true = np.array(y_true)

        tp = np.sum((y_true == 1) & (y_pred == 1))
        tn = np.sum((y_true == 0) & (y_pred == 0))
        fp = np.sum((y_true == 0) & (y_pred == 1))
        fn = np.sum((y_true == 1) & (y_pred == 0))

        self.tp.assign_add(tp)
        self.tn.assign_add(tn)
        self.fp.assign_add(fp)
        self.fn.assign_add(fn)

    def result(self):
        numerator = (self.tp * self.tn) - (self.fp * self.fn)
        denominator = np.sqrt((self.tp + self.fp) * (self.tp + self.fn) * (self.tn + self.fp) * (self.tn + self.fn))
        return numerator / (denominator + keras.backend.epsilon())

    def reset_state(self):
        self.tp.assign(0)
        self.tn.assign(0)
        self.fp.assign(0)
        self.fn.assign(0)


def load_model():
    print("Loading CryptoBench model ...")
    # TODO: fix this, it does not work...
    return keras.models.load_model(MODEL_PATH, compile=False)


def predict(X: np.ndarray, model: keras.Model):
    print("Making prediction ...")
    return model.predict(X)


def load_data(embedding_path: os.PathLike):
    print("Loading data - embeddings ...")
    embeddings = np.load(embedding_path)
    return embeddings


def compute_prediction2(embedding_path: os.PathLike):
    model = load_model()
    print("Model loaded")
    embeddings = load_data(embedding_path)
    print(f"Embeddings loaded: {embeddings.shape}")
    predictions = predict(embeddings, model)
    return predictions
