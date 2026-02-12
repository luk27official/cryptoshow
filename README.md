# CryptoShow

CryptoShow is an application for detection of protein binding sites utilizing the [CryptoBench model](https://github.com/skrhakv/TinyCryptobench) and [ESM-2 embeddings](https://github.com/facebookresearch/esm).

## Build

Build using Docker: `docker compose --profile <cpu/gpu> build` or `docker buildx bake <cpu/gpu>` (experimental). Make sure to specify `--profile gpu` to run with CUDA or `--profile cpu` to run on CPU.

For monitoring, also include `--profile monitoring`.

## Run 

To run the Docker Compose, use  `docker compose --profile <cpu/gpu> up`.

The frontend is available at `localhost:80`. 

For SSL, set `ENABLE_SSL=true`, `CERTBOT_ENABLED=true`, `DOMAIN` and `CERTBOT_EMAIL` in your `.env` and add `--profile certbot` when starting. Certbot will automatically obtain and renew Let's Encrypt certificates inside Docker.

Also, when developing behind a proxy, change the `HTTP_PROXY` and `HTTPS_PROXY` env variables.

## Local Frontend Development

See `frontend/README.md`.

## Local Backend Development

See `backend/README.md`.

## Deployment

1. Install Docker
2. Create `.env` and set up the vars (set `CERTBOT_ENABLED=true` for SSL)
3. Enable ports in firewall (`sudo ufw allow 443`, `sudo ufw allow 80`)
4. Set up the permissions for the user `2727`, i.e. `sudo chown -R 2727:2727 ./data`. Optionally, customize the `UID` and `GID` env vars.
5. Run Docker
6. Optionally, set up the continuous deployment (see `.github/workflows/production-deploy.yml`, make sure that the user is in the `docker` group and that `sudo chown root:docker /var/run/docker.sock && sudo chmod 660 /var/run/docker.sock`)
7. Optionally, set up monitoring credentials by creating the `.htpasswd` file (`sudo apt install apache2-utils`, `htpasswd -c ./frontend/monitoring.htpasswd admin`)

## Technical Requirements

- RAM: minimum 32 GB, preferred 64 GB
- CPU: minimum 8 cores, preferred 8+ cores
- OS: anything running Docker (preferrably Linux)
- disk: depends on number of processed structures

## Maintenance Mode

To toggle the maintenance mode, create/delete the `./frontend/maintenance/maintenance.flag` file (the file can be empty).

## Monitoring

After setting up the monitoring credentials (see Deployment), you can access the monitoring services via `localhost/grafana` and `localhost/flower`.

## TLDR

`docker-compose --profile <gpu/cpu> up --build`, `localhost:80/443`
