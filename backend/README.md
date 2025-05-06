# Backend

To run the backend service, Docker is strongly recommended (if interested in running the backend purely locally, check the `Dockerfile` and `docker-compose.yml` in the root folder, keep in mind that you will need to run the Celery workers as well).

For type hints, install the required packages by running `uv venv && uv lock && uv sync`. You can get `uv` from the official website or by running `pip install uv`.

A simple command like `docker-compose up --build -d backend -d <worker-cpu/worker-gpu>` should do the trick for re-building during the development.
