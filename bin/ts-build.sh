#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

# Get the directory where the script is being called from (caller's project root)
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

# Get the directory where this script lives (inside @jterrazz/typescript)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../config/rolldown.build.config.js"

printf "${CYAN_BG}${BRIGHT_WHITE} BUILD ${NC} Building with Rolldown...\n\n"

printf "Project root: %s\n" "$PROJECT_ROOT"
printf "Config path: %s\n\n" "$CONFIG_PATH"

cd "$PROJECT_ROOT"

if ! npx rolldown --config "$CONFIG_PATH"; then
    printf "${RED}✗ Build failed${NC}\n"
    exit 1
fi

printf "\n${GREEN}✓ Build completed${NC}\n"
