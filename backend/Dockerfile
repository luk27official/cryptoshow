FROM python:3.12 AS base

RUN groupadd -g 2727 cryptoshow && \
    useradd -r -u 2727 -g cryptoshow cryptoshow

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

COPY pyproject.toml .

ENV PATH="/home/cryptoshow/.local/bin:/root/.cargo/bin:$PATH"

RUN pip install --no-cache-dir uv==0.7.1 && uv venv && uv lock && uv sync

COPY . .

USER root

RUN find /app -path "/app/.venv" -prune -o -exec chown cryptoshow:cryptoshow {} \;

EXPOSE 5000

# === Full build (with ESM-2 at first startup) ===
FROM common AS full

USER root

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER cryptoshow

ENTRYPOINT ["/entrypoint.sh"]

CMD ["/app/.venv/bin/fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]

# === Fast build (no ESM-2 at first startup) ===
FROM common AS fast

USER root

COPY entrypoint.sh /entrypoint_fast.sh
RUN chmod +x /entrypoint_fast.sh

USER cryptoshow

ENTRYPOINT ["/entrypoint_fast.sh"]

CMD ["/app/.venv/bin/fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]

# skips the ESM-2 download
