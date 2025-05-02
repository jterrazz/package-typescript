#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
ACCENT_BG='\033[48;5;31m'   # TypeScript blue
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Get the directory where the script is being called from (caller's project root)
# If called through bin, we need to get the directory where the command was executed
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

echo "${ACCENT_BG}${WHITE} START ${NC} Starting TypeScript compilation process..."

# Default paths relative to project root
IN_PATH="$PROJECT_ROOT/src"
OUT_PATH="$PROJECT_ROOT/dist"

echo "Input directory: $IN_PATH"
echo "Output directory: $OUT_PATH"

# Convert tsconfig.json to .swcrc
echo "${ACCENT_BG}${WHITE} STEP ${NC} Converting tsconfig.json to .swcrc..."
TMP_SWCRC=$(mktemp -q /tmp/.swcrc.XXXXXX)
if [ $? -ne 0 ]; then
    echo "${RED}✗ Error: Can't create temporary .swcrc file${NC}"
    exit 1
fi

# Ensure we're in the project root directory for TypeScript configuration
cd "$PROJECT_ROOT"
npx tsconfig-to-swcconfig --output="$TMP_SWCRC"
echo "${GREEN}✓ Completed${NC}"

# Create typescript declaration files
echo "${ACCENT_BG}${WHITE} STEP ${NC} Generating TypeScript declaration files..."
npx tsc --rootDir "$IN_PATH" --declaration --emitDeclarationOnly --outDir "$OUT_PATH"
echo "${GREEN}✓ Completed${NC}"

# Create javascript ESM files with improved source maps
echo "${ACCENT_BG}${WHITE} STEP ${NC} Compiling TypeScript to ESM with source maps..."
if ! "$PROJECT_ROOT/node_modules/.bin/swc" "$IN_PATH" \
    --source-maps \
    --copy-files \
    --config-file "$TMP_SWCRC" \
    --out-dir "$OUT_PATH" \
    --strip-leading-paths \
    --log-watch-compilation \
    "$@"; then
    echo "${RED}✗ SWC compilation failed${NC}"
    exit 1
fi
echo "${GREEN}✓ Completed${NC}"

# Create javascript CJS files
echo "${ACCENT_BG}${WHITE} STEP ${NC} Creating CommonJS bundle..."
if ! npx rollup "$OUT_PATH/index.js" --format cjs --file "$OUT_PATH/index.cjs" --silent; then
    echo "${RED}✗ Rollup bundling failed${NC}"
    exit 1
fi
echo "${GREEN}✓ Completed${NC}"

echo "${ACCENT_BG}${WHITE} END ${NC} Finalizing compilation process..."
echo "${GREEN}✓ Completed${NC}"