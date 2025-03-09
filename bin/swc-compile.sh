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

# Create typescript declaration files
tsc --declaration --emitDeclarationOnly --outDir "$OUT_PATH"

# Create javascript ESM files
npx swc "$IN_PATH" --source-maps --copy-files --config-file "$TMP_SWCRC" --out-dir "$OUT_PATH" --strip-leading-paths "$@"

# Create javascript CJS files
rollup $OUT_PATH/index.js --format cjs --name --file $OUT_PATH/index.cjs