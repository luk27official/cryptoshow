FROM python:3.12 AS base

RUN groupadd -g 1000 cryptoshow && \
    useradd -r -u 1000 -g cryptoshow cryptoshow

RUN mkdir -p /home/cryptoshow/.cache/torch/hub/checkpoints && \
    chown -R cryptoshow:cryptoshow /home/cryptoshow/ && \
    mkdir -p /app/cryptobench-small && \
    mkdir /app/data && \
    chown -R cryptoshow:cryptoshow /app /app/data /app/cryptobench-small

# ESM-2 downloader
FROM base as downloader

WORKDIR /download

RUN mkdir -p /home/cryptoshow/.cache/torch/hub/checkpoints && \
    chown -R cryptoshow:cryptoshow /home/cryptoshow/

USER cryptoshow

RUN wget https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D.pt -O /home/cryptoshow/.cache/torch/hub/checkpoints/esm2_t33_650M_UR50D.pt

# Main image
FROM base as final

WORKDIR /app

COPY requirements.txt .

RUN wget -q https://github.com/skrhakv/TinyCryptoBench/raw/3adde8c5489f5f52b3df6c5b1bbd80898ea3a2c2/data/model-650M.pt -O /app/cryptobench-small/model-650M.pt && \
    pip install --no-cache-dir -r requirements.txt

COPY --from=downloader --chown=cryptoshow:cryptoshow /home/cryptoshow/.cache/torch/hub/checkpoints/esm2_t33_650M_UR50D.pt /home/cryptoshow/.cache/torch/hub/checkpoints/esm2_t33_650M_UR50D.pt

COPY . .

RUN chown -R cryptoshow:cryptoshow /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000

USER cryptoshow

ENTRYPOINT ["/entrypoint.sh"]

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]