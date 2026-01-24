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

ROLLDOWN=$(find_binary rolldown)
NODEMON=$(find_binary nodemon)

# Add both bin directories to PATH so plugins can find binaries like tsgo
export PATH="$PACKAGE_ROOT/node_modules/.bin:$PROJECT_ROOT/node_modules/.bin:$PATH"

# Parse command
COMMAND="$1"
shift 2>/dev/null || true

case "$COMMAND" in
    build)
        # Parse build arguments (required: --app or --lib)
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

        CONFIG_PATH="$SCRIPT_DIR/../config/rolldown.build.config.js"

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Building with Rolldown (${BUILD_MODE} mode)...\n\n"
        printf "Project root: %s\n" "$PROJECT_ROOT"
        printf "Config path: %s\n\n" "$CONFIG_PATH"

        cd "$PROJECT_ROOT"

        if ! BUILD_MODE="$BUILD_MODE" "$ROLLDOWN" --config "$CONFIG_PATH"; then
            printf "${RED}Error: Build failed${NC}\n"
            exit 1
        fi

        printf "\n${GREEN}Build completed${NC}\n"
        ;;

    watch)
        CONFIG_PATH="$SCRIPT_DIR/../config/rolldown.dev.config.js"

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Starting watch mode...\n\n"
        printf "Project root: %s\n" "$PROJECT_ROOT"
        printf "Config path: %s\n" "$CONFIG_PATH"
        printf "Watching: %s/src\n\n" "$PROJECT_ROOT"

        cd "$PROJECT_ROOT"

        "$NODEMON" --quiet \
            --watch src \
            --ext 'ts,tsx,js,json' \
            --exec "if OUTPUT=\$(\"$ROLLDOWN\" --config \"$CONFIG_PATH\" 2>&1); then printf '${GREEN}Rebuilt${NC}\n'; node --enable-source-maps dist/index.js; else echo \"\$OUTPUT\" | grep -v 'tsgo.*experimental' | grep -v 'PLUGIN_TIMINGS'; exit 1; fi"
        ;;

    *)
        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} TypeScript/Node project toolkit\n\n"
        printf "Usage: typescript <command> [options]\n\n"
        printf "Commands:\n"
        printf "  build    Build the project\n"
        printf "  watch    Start watch mode (build + run on changes)\n\n"
        printf "Build options:\n"
        printf "  --app    Build for applications (ESM + types)\n"
        printf "  --lib    Build for libraries (ESM + CJS + types)\n\n"
        printf "Examples:\n"
        printf "  typescript build --lib\n"
        printf "  typescript build --app\n"
        printf "  typescript watch\n"
        exit 1
        ;;
esac
