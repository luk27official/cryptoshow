import torch
import esm
import numpy as np
import os


def compute_esm2(input_file: str, output_file: str):
    # NOTE: t36 currently requires >16 GB of RAM, not using now
    models = [(esm.pretrained.esm2_t33_650M_UR50D, 33), (esm.pretrained.esm2_t36_3B_UR50D, 36)]

    model_idx = 0

    model, alphabet = models[model_idx][0]()
    layers = models[model_idx][1]

    batch_converter = alphabet.get_batch_converter()
    device = torch.device(f"cuda:0" if (torch.cuda.is_available()) else "cpu")
    model.to(device)

    i = 0
    name, ext = os.path.splitext(input_file)

    with open(input_file, "r") as f:
        sequence = f.read()
        threshold = 1022
        vectors = []
        while len(sequence) > 0:
            sequence1 = sequence[:threshold]
            sequence = sequence[threshold:]
            data = [(name, sequence1)]
            _, _, batch_tokens = batch_converter(data)
            batch_tokens = batch_tokens.to(device)
            with torch.no_grad():
                results = model(batch_tokens, repr_layers=[layers], return_contacts=True)
            token_representations = results["representations"][layers]
            vectors1 = token_representations.detach().cpu().numpy()[0][1:-1]
            if len(vectors) > 0:
                vectors = np.concatenate((vectors, vectors1))
            else:
                vectors = vectors1

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        np.save(output_file, vectors)
