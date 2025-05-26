import torch
from transformers import AutoTokenizer, EsmModel
import numpy as np
import torch.nn as nn

MODEL_NAME = "facebook/esm2_t33_650M_UR50D"
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


def compute_prediction(sequence: str) -> np.ndarray:
    """
    Compute the residue-level prediction using the CryptoBench model.

    Args:
        sequence (str): Sequence of amino acids to be predicted.

    Returns:
        np.ndarray: The predicted scores for each residue.
    """
    model = FinetuneESM(MODEL_NAME).to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE), strict=True)

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model.eval()

    KRAS_sequence = str(sequence)  # copy the sequence to avoid modifying the original input
    final_output = []

    # Process sequence in chunks of SEQUENCE_MAX_LENGTH
    for i in range(0, len(KRAS_sequence), SEQUENCE_MAX_LENGTH):
        processed_sequence = KRAS_sequence[i : i + SEQUENCE_MAX_LENGTH]

        tokenized_sequences = tokenizer(
            processed_sequence, max_length=MAX_LENGTH, padding="max_length", truncation=True
        )
        tokenized_sequences = {k: torch.tensor([v]).to(DEVICE) for k, v in tokenized_sequences.items()}

        output, _, _ = model(tokenized_sequences)
        output = output.flatten()

        mask = (tokenized_sequences["attention_mask"] == 1).flatten()

        output = torch.sigmoid(output[mask][1:-1]).detach().cpu().numpy()
        final_output.extend(output)

    return np.array(final_output).flatten()
