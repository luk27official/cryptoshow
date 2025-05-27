# CryptoShow

CryptoShow is an application for detection of protein binding sites utilizing the [CryptoBench model](https://github.com/skrhakv/TinyCryptobench) and [ESM-2 embeddings](https://github.com/facebookresearch/esm).

## Build

Build using Docker: `docker compose --profile <cpu/gpu> build` or `docker buildx bake <cpu/gpu>` (experimental). Make sure to specify `--profile gpu` to run with CUDA or `--profile cpu` to run on CPU.

For monitoring, also include `--profile monitoring`.

## Run 

To run the Docker Compose, use  `docker compose --profile <cpu/gpu> up`.

The frontend is available at `localhost:80`. 

To enable SSL (e.g. for production, use the `ENABLE_SSL` environment variable), then use `https://localhost` (port 443). Make sure to set up the `SSL_CERT_PATH` and `SSL_KEY_PATH` environment variables. For local SSL development, you might use `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/dev.key -out ssl/dev.crt -subj "/CN=localhost"` to generate the certificate/key pair.

Also, when developing behind a proxy, change the `HTTP_PROXY` and `HTTPS_PROXY` env variables.

## Local frontend development

See `frontend/README.md`.

## Local backend development

See `backend/README.md`.

## Deployment

1. Install Docker
2. Get SSL certificates (`sudo certbot certonly --standalone -d <domain>`)
3. Copy the certificates manually into `./frontend/ssl` (or run `sudo renew_certs.sh` in `./frontend/nginx`), optionally set up a cronjob to auto-renew the certificates
4. Create `.env` and set up the vars
5. Enable ports in firewall (`sudo ufw allow 443`, `sudo ufw allow 80`)
6. Set up the permissions for the user `2727`, i.e. `sudo chown -R 2727:2727 ./data`. Optionally, customize the `UID` and `GID` env vars.
7. Run Docker
8. Optionally, set up the continuous deployment (see `.github/workflows/production-deploy.yml`, make sure that the user is in the `docker` group and that `sudo chown root:docker /var/run/docker.sock && sudo chmod 660 /var/run/docker.sock`)
9. Optionally, set up monitoring credentials by creating the `.htpasswd` file (`sudo apt install apache2-utils`, `htpasswd -c ./frontend/monitoring.htpasswd admin`)

## Maintenance mode

To toggle the maintenance mode, create/delete the `./frontend/maintenance/maintenance.flag` file (the file can be empty).

## Monitoring

After setting up the monitoring credentials (see Deployment), you can access the monitoring services via `localhost/grafana` and `localhost/flower`.

## TLDR

`docker-compose --profile <gpu/cpu> up --build`, `localhost:80/443`
