import torch
import esm
import numpy as np
import os


def compute_esm2(input_file: os.PathLike, output_file: os.PathLike, logger):
    # TODO: change the model here... t36 currently requires >16 GB of RAM, that's why im using 12
    layers = 12
    model, alphabet = esm.pretrained.esm2_t12_35M_UR50D()
    # model, alphabet = esm.pretrained.esm2_t36_3B_UR50D()

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
                # TODO: change the number of layers accordingly to the model size...
                results = model(batch_tokens, repr_layers=[layers], return_contacts=True)
            token_representations = results["representations"][layers]
            vectors1 = token_representations.detach().cpu().numpy()[0][1:-1]
            if len(vectors) > 0:
                vectors = np.concatenate((vectors, vectors1))
            else:
                vectors = vectors1

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        np.save(output_file, vectors)
