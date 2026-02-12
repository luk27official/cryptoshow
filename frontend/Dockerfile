FROM oven/bun:slim AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# copy the rest of the application
COPY . .

RUN bun run build

# Use NginX to serve the built frontend and serve as a reverse proxy to the backend
FROM nginx:alpine AS production

RUN apk add --no-cache openssl \
 && mkdir -p /var/www/certbot

COPY --from=builder /app/dist /usr/share/nginx/html
COPY public/maintenance.html /usr/share/nginx/html/maintenance.html

COPY nginx/nginx.conf /etc/nginx/nginx.conf.template
COPY nginx/nginx_ssl_block.conf /etc/nginx/nginx_ssl_block.conf
COPY nginx/nginx_ssl_redirect.conf /etc/nginx/nginx_ssl_redirect.conf
COPY nginx/nginx_monitoring.conf /etc/nginx/nginx_monitoring.conf

COPY nginx/nginx_entrypoint.sh /app/nginx_entrypoint.sh

RUN chmod +x /app/nginx_entrypoint.sh

ENTRYPOINT ["/app/nginx_entrypoint.sh"]

EXPOSE 80 443
