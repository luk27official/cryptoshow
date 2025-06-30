import torch
from transformers import AutoTokenizer, EsmModel
import numpy as np
import torch.nn as nn
import os

ESM_MODEL_NAME = "facebook/esm2_t33_650M_UR50D"
MAX_LENGTH = 1024
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OUTPUT_SIZE = 1
DROPOUT = 0.25
SEQUENCE_MAX_LENGTH = MAX_LENGTH - 2
MODEL_PATH = "/app/cryptobench-small/model-650M-finetuned.pt"


class FinetuneESM(nn.Module):
    def __init__(self, esm_model: str) -> None:
        super().__init__()
        self.llm = EsmModel.from_pretrained(esm_model)
        self.dropout = nn.Dropout(DROPOUT)
        self.classifier = nn.Linear(self.llm.config.hidden_size, OUTPUT_SIZE)
        self.plDDT_regressor = nn.Linear(self.llm.config.hidden_size, OUTPUT_SIZE)
        self.distance_regressor = nn.Linear(self.llm.config.hidden_size, OUTPUT_SIZE)

    def forward(self, batch: dict[str, np.ndarray]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        input_ids, attention_mask = batch["input_ids"], batch["attention_mask"]
        token_embeddings = self.llm(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state

        return (
            self.classifier(token_embeddings),
            self.plDDT_regressor(token_embeddings),
            self.distance_regressor(token_embeddings),
        )


def compute_prediction(sequence: str, job_path: str, chain: str) -> np.ndarray:
    """
    Compute the residue-level prediction using the CryptoBench model.
    Also saves the embeddings for the sequence in the specified job path - this is needed for cluster refinement.

    Args:
        sequence (str): Sequence of amino acids to be predicted.
        job_path (str): Path to the job directory where results will be saved.
        chain (str): Chain identifier for the sequence.

    Returns:
        np.ndarray: The predicted scores for each residue.
    """
    model = FinetuneESM(ESM_MODEL_NAME).to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE), strict=True)

    tokenizer = AutoTokenizer.from_pretrained(ESM_MODEL_NAME)
    model.eval()

    KRAS_sequence = str(sequence)
    all_embeddings = []
    final_output = []

    # Process sequence in chunks of SEQUENCE_MAX_LENGTH
    for i in range(0, len(KRAS_sequence), SEQUENCE_MAX_LENGTH):
        processed_sequence = KRAS_sequence[i : i + SEQUENCE_MAX_LENGTH]

        tokenized = tokenizer(
            processed_sequence, max_length=MAX_LENGTH, padding="max_length", truncation=True, return_tensors="pt"
        )
        tokenized = {k: v.to(DEVICE) for k, v in tokenized.items()}

        # embeddings
        with torch.no_grad():
            llm_output = model.llm(input_ids=tokenized["input_ids"], attention_mask=tokenized["attention_mask"])
            embeddings = llm_output.last_hidden_state  # shape: (1, seq_len, hidden_dim)

        embeddings_np = embeddings.squeeze(0).detach().cpu().numpy()
        mask = tokenized["attention_mask"].squeeze(0).detach().cpu().numpy().astype(bool)
        embeddings_np = embeddings_np[mask][1:-1]  # exclude [CLS], [SEP]
        all_embeddings.append(embeddings_np)

        # prediction
        with torch.no_grad():
            output, _, _ = model(tokenized)

        output = output.squeeze(0)
        mask = tokenized["attention_mask"].squeeze(0).bool()
        output = output[mask][1:-1]  # exclude [CLS], [SEP]

        probabilities = torch.sigmoid(output).detach().cpu().numpy()
        final_output.extend(probabilities)

    # save the concatenated embeddings for the entire sequence
    final_embeddings = np.concatenate(all_embeddings, axis=0)
    save_path = os.path.join(job_path, f"embedding_{chain}.npy")
    print(f"Saving embeddings for chain {chain} in {save_path}")
    np.save(save_path, final_embeddings)

    return np.array(final_output).flatten()
