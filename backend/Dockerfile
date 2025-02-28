FROM python:3.12

WORKDIR /app

COPY requirements.txt .

RUN groupadd -g 1000 cryptoshow && \
    useradd -r -u 1000 -g cryptoshow cryptoshow

# TODO: add download of the ESM2 model here...

RUN mkdir -p /app/cryptobench-small && \
    wget -q https://github.com/skrhakv/TinyCryptoBench/blob/3adde8c5489f5f52b3df6c5b1bbd80898ea3a2c2/data/model-650M.pt -O /app/cryptobench-small/model-650M.pt && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R cryptoshow:cryptoshow /app

EXPOSE 5000

USER cryptoshow

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]