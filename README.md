# cryptoshow

build: `docker compose --profile <cpu/gpu> build` or `docker buildx bake <cpu/gpu>`

if you want the build to be faster, create an `.env` file and set `BUILD_TARGET=fast` to skip the download of the ESM-2 model

run: `docker compose --profile <cpu/gpu> up`

available at `localhost:80`

frontend local development: `bun i && bun run dev`, `localhost:3000`
