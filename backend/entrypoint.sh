#!/bin/bash

mkdir -p /app/data/jobs

if [ ! -f /app/cryptobench-small/model-650M-finetuned.pt ]; then
    wget --progress=dot:giga localhost -O /app/cryptobench-small/model-650M-finetuned.pt # TODO: replace with actual URL 
fi

exec "$@"