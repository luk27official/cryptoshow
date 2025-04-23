FROM python:3.12 AS base

RUN groupadd -g 1000 cryptoshow && \
    useradd -r -u 1000 -g cryptoshow cryptoshow

RUN mkdir -p /home/cryptoshow/.cache/torch/hub/checkpoints && \
    chown -R cryptoshow:cryptoshow /home/cryptoshow/ && \
    mkdir -p /app/cryptobench-small && \
    mkdir /app/data && \
    chown -R cryptoshow:cryptoshow /app /app/data /app/cryptobench-small

# === shared setup (requirements, CryptoBench) ===
FROM base AS common

WORKDIR /download

RUN mkdir -p /home/cryptoshow/.cache/torch/hub/checkpoints && \
    chown -R cryptoshow:cryptoshow /home/cryptoshow/

USER cryptoshow

WORKDIR /app

COPY requirements.txt .

RUN wget --progress=dot:giga https://github.com/skrhakv/TinyCryptoBench/raw/3adde8c5489f5f52b3df6c5b1bbd80898ea3a2c2/data/model-650M.pt -O /app/cryptobench-small/model-650M.pt

ENV PATH="/home/cryptoshow/.local/bin:$PATH"

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER root

RUN chown -R cryptoshow:cryptoshow /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000

USER cryptoshow

ENTRYPOINT ["/entrypoint.sh"]

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]

# === Full build (with ESM-2) ===
FROM common AS full

RUN wget --progress=dot:giga https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D.pt \
    -O /home/cryptoshow/.cache/torch/hub/checkpoints/esm2_t33_650M_UR50D.pt

# === Fast build (no ESM-2) ===
FROM common AS fast

# skips the ESM-2 download
