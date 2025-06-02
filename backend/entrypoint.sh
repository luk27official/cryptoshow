#!/bin/bash

mkdir -p /app/data/jobs

MODEL_FILE=/app/cryptobench-small/model-650M-finetuned.pt
SMOOTHENING_MODEL_FILE=/app/cryptobench-small/smoothening_model-650M-finetuned.pt

if [ ! -f "$MODEL_FILE" ]; then
    wget --no-check-certificate --progress=dot:giga https://owncloud.cesnet.cz/index.php/s/mPo9NCWMBouwVAo/download -O "$MODEL_FILE"

    # This is just a sanity check that we downloaded the correct model file - if needed, 
    # set the EXPECTED_HASH to an empty string to skip this verification.
    ACTUAL_HASH=$(sha256sum "$MODEL_FILE" | awk '{print $1}')
    EXPECTED_HASH="ca2cb0d6a666446cf2a9671c8cccbbede445c0667b385b0a67e6f81b13713f25"

    if [ -n "$EXPECTED_HASH" ]; then
        ACTUAL_HASH=$(sha256sum "$MODEL_FILE" | awk '{print $1}')
        
        if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
            echo "✅ Hash OK"
        else
            echo "❌ Hash MISMATCH"
            echo "Expected: $EXPECTED_HASH"
            echo "Actual:   $ACTUAL_HASH"
            echo "This means potential security violation! Consider checking the file URL..."
            exit 1
        fi
    else
        echo "⚠️  Skipping hash check: no expected hash provided."
    fi
fi

if [ ! -f "$SMOOTHENING_MODEL_FILE" ]; then
    # This is hosted by me on GitHub, so it should be safe to download.
    wget --no-check-certificate --progress=dot:giga https://github.com/luk27official/cryptoshow-benchmark/raw/refs/heads/main/smoothening/pretrained_models/cryptobench_classifier.pt -O "$SMOOTHENING_MODEL_FILE"
fi

exec "$@"