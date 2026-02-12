#!/bin/sh

SSL_BLOCK_CONTENT=""
REDIRECT_BLOCK_CONTENT=""
MONITORING_BLOCK_CONTENT=""

SSL_CERT_PATH="/etc/nginx/ssl/fullchain.pem"
SSL_KEY_PATH="/etc/nginx/ssl/privkey.pem"

if [ "$CERTBOT_ENABLED" = "true" ] && [ "$ENABLE_SSL" = "true" ]; then
  LE_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  LE_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

  if [ -f "$LE_CERT" ] && [ -f "$LE_KEY" ] && [ ! -f "/etc/letsencrypt/live/${DOMAIN}/.selfsigned" ]; then
    echo "[certbot] Using existing Let's Encrypt certificates."
    SSL_CERT_PATH="$LE_CERT"
    SSL_KEY_PATH="$LE_KEY"
  else
    echo "[certbot] Let's Encrypt certificates not available yet."
    echo "[certbot] Generating temporary self-signed certificate so nginx can start..."
    mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
    openssl req -x509 -nodes -days 7 -newkey rsa:2048 \
      -keyout "$LE_KEY" \
      -out "$LE_CERT" \
      -subj "/CN=${DOMAIN}" 2>/dev/null
    # marker so certbot knows to replace this with a real cert
    touch "/etc/letsencrypt/live/${DOMAIN}/.selfsigned"
    SSL_CERT_PATH="$LE_CERT"
    SSL_KEY_PATH="$LE_KEY"
    echo "[certbot] Temporary self-signed certificate generated."
  fi
fi

if [ "$ENABLE_SSL" = "true" ]; then
  SSL_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_block.conf)
  REDIRECT_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_redirect.conf)
fi

if [ -f /app/data/monitoring.flag ]; then
  MONITORING_BLOCK_CONTENT=$(cat /etc/nginx/nginx_monitoring.conf)
fi

# first resolve monitoring in the SSL template
if [ "$ENABLE_SSL" = "true" ] && [ -n "$MONITORING_BLOCK_CONTENT" ]; then
  SSL_BLOCK_CONTENT=$(echo "$SSL_BLOCK_CONTENT" | awk -v monitoring="$MONITORING_BLOCK_CONTENT" '{gsub(/\{\{MONITORING\}\}/, monitoring); print}')
fi

# resolve SSL certificate paths in the SSL block
if [ "$ENABLE_SSL" = "true" ]; then
  SSL_BLOCK_CONTENT=$(echo "$SSL_BLOCK_CONTENT" | awk -v cert="$SSL_CERT_PATH" -v key="$SSL_KEY_PATH" '{gsub(/\{\{SSL_CERT_PATH\}\}/, cert); gsub(/\{\{SSL_KEY_PATH\}\}/, key); print}')
fi

# replace all placeholders in the main template
awk -v ssl_block="$SSL_BLOCK_CONTENT" -v redirect_block="$REDIRECT_BLOCK_CONTENT" -v monitoring_block="$MONITORING_BLOCK_CONTENT" '
  {
    gsub(/\{\{SSL_BLOCK\}\}/, ssl_block)
    gsub(/\{\{SSL_REDIRECT\}\}/, redirect_block)
    gsub(/\{\{MONITORING\}\}/, monitoring_block)
    print
  }
' /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

if [ "$CERTBOT_ENABLED" = "true" ] && [ "$ENABLE_SSL" = "true" ]; then
  echo "[certbot] Starting background certificate reload (every 6 hours)..."
  (
    while true; do
      sleep 6h
      echo "[certbot] Reloading nginx to pick up renewed certificates..."
      nginx -s reload 2>/dev/null || true
    done
  ) &
fi

exec nginx -g "daemon off;"