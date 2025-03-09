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
npx tsconfig-to-swcconfig --output="$TMP_SWCRC"

# Create typescript declaration files
npx tsc --rootDir "$IN_PATH" --declaration --emitDeclarationOnly --outDir "$OUT_PATH"

# Create javascript ESM files with improved source maps
npx swc "$IN_PATH" \
    --source-maps \
    --copy-files \
    --config-file "$TMP_SWCRC" \
    --out-dir "$OUT_PATH" \
    --strip-leading-paths \
    --log-watch-compilation \
    "$@"

# Create javascript CJS files
npx rollup "$OUT_PATH/index.js" --format cjs --file "$OUT_PATH/index.cjs"