#!/bin/bash
set -e

sudo certbot renew --quiet

SRC="/etc/letsencrypt/live/$DOMAIN"
DST="$(dirname "$0")/../ssl"

echo "Copying updated certs from $SRC to $DST..."

mkdir -p "$DST"

cp -L "$SRC/fullchain.pem" "$DST/"
cp -L "$SRC/privkey.pem" "$DST/"

echo "Certs updated at $DST"
