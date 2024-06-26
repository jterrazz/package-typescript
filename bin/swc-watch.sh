#!/bin/bash
IN_PATH=src
OUT_PATH=dist

# Convert tsconfig.json to .swcrc
TMP_SWCRC=$(mktemp -q /tmp/.swcrc.XXXXXX)
if [ $? -ne 0 ]; then
    echo "$0: Can't create temporary .swcrc file"
    exit 1
fi
tsconfig-to-swcconfig --output="$TMP_SWCRC"

# Watch for changes in the src directory, compile and run
nodemon --quiet --watch src --ext '*' --exec "swc $IN_PATH --source-maps --quiet --copy-files --config-file $TMP_SWCRC --out-dir $OUT_PATH --strip-leading-paths && node --enable-source-maps $OUT_PATH/index.js"
