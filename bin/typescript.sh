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

# Get the real directory where this script lives (resolve symlinks)
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    LINK_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ $SCRIPT_PATH != /* ]] && SCRIPT_PATH="$LINK_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
PACKAGE_ROOT="$SCRIPT_DIR/.."

# Find binaries - check package's node_modules first, then project's (handles npm hoisting)
find_binary() {
    local name="$1"
    if [ -x "$PACKAGE_ROOT/node_modules/.bin/$name" ]; then
        echo "$PACKAGE_ROOT/node_modules/.bin/$name"
    elif [ -x "$PROJECT_ROOT/node_modules/.bin/$name" ]; then
        echo "$PROJECT_ROOT/node_modules/.bin/$name"
    else
        echo "$name"  # Fallback to PATH
    fi
}

TSDOWN=$(find_binary tsdown)
NODEMON=$(find_binary nodemon)

# Parse command
COMMAND="$1"
shift 2>/dev/null || true

run_tsdown() {
    local CONFIG_PATH="$1"
    local LABEL="$2"

    printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} ${LABEL}...\n\n"

    cd "$PROJECT_ROOT"

    if ! "$TSDOWN" --config "$CONFIG_PATH" --cwd "$PROJECT_ROOT"; then
        printf "${RED}Error: Build failed${NC}\n"
        exit 1
    fi

    printf "\n${GREEN}Build completed${NC}\n"
}

case "$COMMAND" in
    build)
        run_tsdown "$SCRIPT_DIR/../config/tsdown.app.ts" "Building application (ESM + types)"
        ;;

    bundle)
        run_tsdown "$SCRIPT_DIR/../config/tsdown.lib.ts" "Bundling library (ESM + CJS + types)"
        ;;

    watch)
        CONFIG_PATH="$SCRIPT_DIR/../config/tsdown.watch.ts"

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Starting watch mode...\n\n"

        cd "$PROJECT_ROOT"

        "$NODEMON" --quiet \
            --watch src \
            --ext 'ts,tsx,js,json' \
            --exec "if OUTPUT=\$(\"$TSDOWN\" --config \"$CONFIG_PATH\" --cwd \"$PROJECT_ROOT\" 2>&1); then printf '${GREEN}Rebuilt${NC}\n'; node --enable-source-maps dist/index.js; else echo \"\$OUTPUT\"; exit 1; fi"
        ;;

    *)
        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} TypeScript/Node project toolkit\n\n"
        printf "Usage: typescript <command>\n\n"
        printf "Commands:\n"
        printf "  build     Build application (ESM + types)\n"
        printf "  bundle    Bundle library (ESM + CJS + types)\n"
        printf "  watch     Watch mode (build + run on changes)\n\n"
        printf "Examples:\n"
        printf "  typescript build\n"
        printf "  typescript bundle\n"
        printf "  typescript watch\n"
        exit 1
        ;;
esac
