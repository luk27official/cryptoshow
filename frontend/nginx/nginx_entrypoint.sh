#!/bin/sh

SSL_BLOCK_CONTENT=""
REDIRECT_BLOCK_CONTENT=""

if [ "$ENABLE_SSL" = "true" ]; then
  SSL_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_block.conf)
  REDIRECT_BLOCK_CONTENT=$(cat /etc/nginx/nginx_ssl_redirect.conf)
fi

# replace both placeholders in the template
awk -v ssl_block="$SSL_BLOCK_CONTENT" -v redirect_block="$REDIRECT_BLOCK_CONTENT" '
  {
    gsub(/\{\{SSL_BLOCK\}\}/, ssl_block)
    gsub(/\{\{SSL_REDIRECT\}\}/, redirect_block)
    print
  }
' /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"