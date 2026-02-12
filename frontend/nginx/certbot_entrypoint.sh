#!/bin/sh
# Certbot entrypoint script for automatic SSL certificate management.
# Runs inside the certbot Docker container with shared volumes.
# Handles initial certificate acquisition and periodic renewal.
set -e

DOMAIN="${DOMAIN:-localhost}"
EMAIL="${CERTBOT_EMAIL:-}"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

echo "[certbot] Starting certbot service for domain: $DOMAIN"

EMAIL_ARG=""
if [ -n "$EMAIL" ]; then
  EMAIL_ARG="--email $EMAIL"
else
  EMAIL_ARG="--register-unsafely-without-email"
  echo "[certbot] WARNING: No CERTBOT_EMAIL set. Using --register-unsafely-without-email."
fi

# Wait for nginx to be ready and serving the webroot
echo "[certbot] Waiting for nginx to be ready..."
sleep 15

# Check if we already have a valid Let's Encrypt certificate
REQUEST_CERT=false

if [ -d "$CERT_PATH" ] && [ -f "$CERT_PATH/fullchain.pem" ]; then
  if [ -f "$CERT_PATH/.selfsigned" ]; then
    echo "[certbot] Self-signed placeholder certificate found. Will request a real certificate."
    rm -rf "$CERT_PATH"
    REQUEST_CERT=true
  else
    echo "[certbot] Existing Let's Encrypt certificate found. Skipping initial request."
  fi
else
  echo "[certbot] No certificate found at $CERT_PATH."
  REQUEST_CERT=true
fi

if [ "$REQUEST_CERT" = "true" ]; then
  echo "[certbot] Requesting initial certificate for $DOMAIN..."

  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    $EMAIL_ARG \
    -d "$DOMAIN" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal

  if [ $? -eq 0 ]; then
    echo "[certbot] Initial certificate obtained successfully!"
  else
    echo "[certbot] ERROR: Failed to obtain initial certificate. Will retry on next renewal cycle."
  fi
fi

# Renewal loop - check every 12 hours
echo "[certbot] Entering renewal loop (checking every 12 hours)..."
while true; do
  sleep 12h
  echo "[certbot] Checking for certificate renewal..."

  certbot renew \
    --webroot \
    --webroot-path=/var/www/certbot \
    --non-interactive

  echo "[certbot] Renewal check complete at $(date)"
done
