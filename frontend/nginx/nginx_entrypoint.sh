#!/bin/sh

SSL_BLOCK_CONTENT=""
REDIRECT_BLOCK_CONTENT=""
MONITORING_BLOCK_CONTENT=""

if [ "$ENABLE_SSL" = "true" ]; then
  SSL_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_block.conf)
  REDIRECT_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_redirect.conf)
fi

if [ -f /app/data/monitoring.flag ]; then
  MONITORING_BLOCK_CONTENT=$(cat /etc/nginx/nginx_monitoring.conf)
fi

# first resolve monitoring in the SSL template
if [ "$ENABLE_SSL" = "true" ] && [ -n "$MONITORING_BLOCK_CONTENT" ]; then
  SSL_BLOCK_CONTENT=$(echo "$SSL_BLOCK_CONTENT" | sed "s|{{MONITORING}}|$MONITORING_BLOCK_CONTENT|g")
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

exec nginx -g "daemon off;"