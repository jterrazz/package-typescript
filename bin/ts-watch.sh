#!/bin/bash

# Exit on error
set -e

# Colors for output (using Vitest-like colors)
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'  # Cyan background
BRIGHT_WHITE='\033[1;30m'  # Bold black text
NC='\033[0m' # No Color

# Get the directory where the script is being called from (caller's project root)
# If called through bin, we need to get the directory where the command was executed
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

printf "${CYAN_BG}${BRIGHT_WHITE} START ${NC} Starting TypeScript watch mode\n\n"

# Default paths relative to project root
IN_PATH="$PROJECT_ROOT/src"
OUT_PATH="$PROJECT_ROOT/dist"

printf "Input directory: %s\n" "$IN_PATH"
printf "Output directory: %s\n" "$OUT_PATH"

# Convert tsconfig.json to .swcrc
printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Converting tsconfig.json to .swcrc\n\n"
TMP_SWCRC=$(mktemp -q /tmp/.swcrc.XXXXXX)
if [ $? -ne 0 ]; then
    printf "${RED}✗ Error: Can't create temporary .swcrc file${NC}\n"
    exit 1
fi

# Ensure we're in the project root directory for TypeScript configuration
cd "$PROJECT_ROOT"
npx tsconfig-to-swcconfig --output="$TMP_SWCRC"
printf "${GREEN}✓ Successfully converted tsconfig.json to .swcrc${NC}\n"

printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Starting watch mode with nodemon\n\n"
printf "Watching for changes in: %s\n" "$IN_PATH"

# Watch for changes in the src directory, compile and run
npx nodemon --quiet \
    --watch "$IN_PATH" \
    --ext '*' \
    --exec "printf 'File change detected, rebuilding\\n' && npx swc $IN_PATH \
        --source-maps \
        --copy-files \
        --config-file $TMP_SWCRC \
        --out-dir $OUT_PATH \
        --strip-leading-paths \
        && printf '${GREEN}✓ Completed${NC}\\n\n' && node --enable-source-maps $OUT_PATH/index.js"
