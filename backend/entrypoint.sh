#!/bin/bash

mkdir -p /app/data/jobs

if [ ! -f /app/cryptobench-small/model-650M-finetuned.pt ]; then
    wget --progress=dot:giga https://owncloud.cesnet.cz/index.php/s/mPo9NCWMBouwVAo/download -O /app/cryptobench-small/model-650M-finetuned.pt
fi

exec "$@"