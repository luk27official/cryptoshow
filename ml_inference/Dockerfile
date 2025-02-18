FROM python:3.12

WORKDIR /app

# TODO: add download of the ESM2 model here...

# TODO: add download of the CryptoBench model here...

# TODO: add CUDA support...

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# copy the rest of the files
COPY . .

EXPOSE 6000

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "6000"]