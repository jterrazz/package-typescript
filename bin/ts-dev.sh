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
CONFIG_PATH="$SCRIPT_DIR/../config/rolldown.dev.config.js"

printf "${CYAN_BG}${BRIGHT_WHITE} DEV ${NC} Starting watch mode...\n\n"

printf "Project root: %s\n" "$PROJECT_ROOT"
printf "Config path: %s\n" "$CONFIG_PATH"
printf "Watching: %s/src\n\n" "$PROJECT_ROOT"

cd "$PROJECT_ROOT"

npx nodemon --quiet \
    --watch src \
    --ext 'ts,tsx,js,json' \
    --exec "if OUTPUT=\$(npx rolldown --config \"$CONFIG_PATH\" 2>&1); then printf '${GREEN}✓ Rebuilt${NC}\n'; node --enable-source-maps dist/index.js; else echo \"\$OUTPUT\" | grep -v 'tsgo.*experimental' | grep -v 'PLUGIN_TIMINGS'; exit 1; fi"
