#!/bin/bash

# Get the directory where the script is being called from (caller's project root)
# If called through bin, we need to get the directory where the command was executed
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

# Default paths relative to project root
IN_PATH="$PROJECT_ROOT/src"
OUT_PATH="$PROJECT_ROOT/dist"

# Convert tsconfig.json to .swcrc
TMP_SWCRC=$(mktemp -q /tmp/.swcrc.XXXXXX)
if [ $? -ne 0 ]; then
    echo "$0: Can't create temporary .swcrc file"
    exit 1
fi

# Ensure we're in the project root directory for TypeScript configuration
cd "$PROJECT_ROOT"
npx tsconfig-to-swcconfig --output="$TMP_SWCRC"

# Watch for changes in the src directory, compile and run
npx nodemon --quiet \
    --watch "$IN_PATH" \
    --ext '*' \
    --exec "npx swc $IN_PATH \
        --source-maps \
        --copy-files \
        --config-file $TMP_SWCRC \
        --out-dir $OUT_PATH \
        --strip-leading-paths \
        && node --enable-source-maps $OUT_PATH/index.js"
