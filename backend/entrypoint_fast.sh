#!/bin/bash

mkdir -p /app/data/jobs

if [ ! -f /app/cryptobench-small/model-650M.pt ]; then
    wget --progress=dot:giga https://github.com/skrhakv/TinyCryptoBench/raw/3adde8c5489f5f52b3df6c5b1bbd80898ea3a2c2/data/model-650M.pt -O /app/cryptobench-small/model-650M.pt
fi

exec "$@"