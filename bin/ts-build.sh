#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

# Parse arguments (required: --app or --lib)
BUILD_MODE=""
for arg in "$@"; do
    case $arg in
        --lib)
            BUILD_MODE="lib"
            ;;
        --app)
            BUILD_MODE="app"
            ;;
    esac
done

if [ -z "$BUILD_MODE" ]; then
    printf "${RED}Error: Build mode required. Use --app or --lib${NC}\n\n"
    printf "  --app  Build for applications (ESM + types)\n"
    printf "  --lib  Build for libraries (ESM + CJS + types)\n"
    exit 1
fi

# Get the directory where the script is being called from (caller's project root)
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

# Get the real directory where this script lives (resolve symlinks)
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    LINK_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ $SCRIPT_PATH != /* ]] && SCRIPT_PATH="$LINK_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../config/rolldown.build.config.js"

printf "${CYAN_BG}${BRIGHT_WHITE} BUILD ${NC} Building with Rolldown (${BUILD_MODE} mode)...\n\n"

printf "Project root: %s\n" "$PROJECT_ROOT"
printf "Config path: %s\n\n" "$CONFIG_PATH"

cd "$PROJECT_ROOT"

if ! BUILD_MODE="$BUILD_MODE" npx rolldown --config "$CONFIG_PATH"; then
    printf "${RED}✗ Build failed${NC}\n"
    exit 1
fi

printf "\n${GREEN}✓ Build completed${NC}\n"
