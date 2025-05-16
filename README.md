# CryptoShow

CryptoShow is an application for detection of protein binding sites utilizing the [CryptoBench model](https://github.com/skrhakv/TinyCryptobench) and [ESM-2 embeddings](https://github.com/facebookresearch/esm).

## Build

Build using Docker: `docker compose --profile <cpu/gpu> build` or `docker buildx bake <cpu/gpu>` (experimental). Make sure to specify `--profile gpu` to run with CUDA or `--profile cpu` to run on CPU.

If you want the build to be faster, create an `.env` file and set `BUILD_TARGET=fast` to skip the download of the ESM-2 model. This is useful for faster builds after the first full build when developing the app.

For monitoring, also include `--profile monitoring`.

## Run 

To run the Docker Compose, use  `docker compose --profile <cpu/gpu> up`.

The frontend is available at `localhost:80`. 

To enable SSL (e.g. for production, use the `ENABLE_SSL` environment variable), then use `https://localhost` (port 443). Make sure to set up the `SSL_CERT_PATH` and `SSL_KEY_PATH` environment variables. For local SSL development, you might use `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/dev.key -out ssl/dev.crt -subj "/CN=localhost"` to generate the certificate/key pair.

Also, when developing behind a proxy with self-signed certificates, it might be useful to turn off external HTTPS verification by introducing the `ENABLE_EXTERNAL_SSL_REQUESTS` environment variable (by default `true`).

## Local frontend development

See `frontend/README.md`.

## Local backend development

See `backend/README.md`.

## TLDR

`docker-compose --profile <gpu/cpu> up --build`, `localhost:80/443`
