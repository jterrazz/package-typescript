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

# Create javascript files
swc "$IN_PATH" --source-maps --copy-files --config-file "$TMP_SWCRC" --out-dir "$OUT_PATH" --strip-leading-paths "$@"

# Create typescript declaration files
tsc $IN_PATH/*.ts --declaration --emitDeclarationOnly --outDir "$OUT_PATH"
