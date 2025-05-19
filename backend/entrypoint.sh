#!/bin/bash

mkdir -p /app/data/jobs

if [ ! -f /app/cryptobench-small/model-650M.pt ]; then
    wget --progress=dot:giga https://github.com/skrhakv/TinyCryptoBench/raw/3adde8c5489f5f52b3df6c5b1bbd80898ea3a2c2/data/model-650M.pt -O /app/cryptobench-small/model-650M.pt
fi

for user_dir in /home/cryptoshow; do
    cache_dir="$user_dir/.cache/torch/hub/checkpoints"
    mkdir -p "$cache_dir"

    if [ ! -f "$cache_dir/esm2_t33_650M_UR50D.pt" ]; then
        wget --progress=dot:giga https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D.pt \
            -O "$cache_dir/esm2_t33_650M_UR50D.pt"
    fi

    if [ ! -f "$cache_dir/esm2_t33_650M_UR50D-contact-regression.pt" ]; then
        wget --progress=dot:giga https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D-contact-regression.pt \
            -O "$cache_dir/esm2_t33_650M_UR50D-contact-regression.pt"
    fi
done

exec "$@"