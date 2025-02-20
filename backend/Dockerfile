FROM python:3.12

WORKDIR /app

COPY requirements.txt .

# TODO: add download of the ESM2 model here...

# TODO: add download of the CryptoBench model here...

# TODO: add CUDA support...

RUN pip install --no-cache-dir -r requirements.txt

# copy the rest of the files
COPY . .

EXPOSE 5000

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]