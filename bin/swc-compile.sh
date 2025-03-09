#!/bin/bash
IN_PATH=src
OUT_PATH=dist

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