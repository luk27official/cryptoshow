#!/bin/bash
# This script is used to renew SSL certificates using Certbot and copy them to a directory for use in an Nginx server.
# It is meant to be run as a cron job or manually when needed - but make sure to run it on the HOST machine, not in the container.
set -e

sudo certbot renew --quiet

SRC="/etc/letsencrypt/live/$DOMAIN"
DST="$(dirname "$0")/../ssl"
MAINTENANCE="$(dirname "$0")/../maintenance"

if [ ! -f "$MAINTENANCE/maintenance.flag" ]; then
    touch "$MAINTENANCE/maintenance.flag"
    echo "Maintenance flag file created at $MAINTENANCE/maintenance.flag"
fi

echo "Copying updated certs from $SRC to $DST..."

mkdir -p "$DST"

cp -L "$SRC/fullchain.pem" "$DST/"
cp -L "$SRC/privkey.pem" "$DST/"

echo "Certs updated at $DST"

echo "Removing maintenance flag file at $MAINTENANCE/maintenance.flag"

if [ -f "$MAINTENANCE/maintenance.flag" ]; then
    echo "Maintenance flag file exists, removing it."
else
    echo "Maintenance flag file does not exist, nothing to remove."
fi
