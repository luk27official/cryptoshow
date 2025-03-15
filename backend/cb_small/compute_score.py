import torch
import numpy as np


def compute_prediction(embedding_path: str):
    print("Running CryptoBench model ...")
    PATH = "/app/cryptobench-small/model-650M.pt"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    model = torch.jit.load(PATH, map_location=device)
    model.eval()

    logits = model(torch.tensor(np.load(embedding_path), dtype=torch.float32).to(device)).squeeze()
    pred = torch.sigmoid(logits)

    return pred.detach().cpu().numpy()
