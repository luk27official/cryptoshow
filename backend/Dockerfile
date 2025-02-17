FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# copy the rest of the files
COPY . .

EXPOSE 5000

CMD ["fastapi", "run", "main.py", "--proxy-headers", "--port", "5000"]