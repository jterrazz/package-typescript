#!/bin/bash

# Get the directory where the script is being called from (caller's project root)
# If called through bin, we need to get the directory where the command was executed
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

echo "👀 Starting TypeScript watch mode..."

# Default paths relative to project root
IN_PATH="$PROJECT_ROOT/src"
OUT_PATH="$PROJECT_ROOT/dist"

echo "📂 Input directory: $IN_PATH"
echo "📂 Output directory: $OUT_PATH"

# Convert tsconfig.json to .swcrc
echo "🔄 Converting tsconfig.json to .swcrc..."
TMP_SWCRC=$(mktemp -q /tmp/.swcrc.XXXXXX)
if [ $? -ne 0 ]; then
    echo "❌ Error: Can't create temporary .swcrc file"
    exit 1
fi

# Ensure we're in the project root directory for TypeScript configuration
cd "$PROJECT_ROOT"
npx tsconfig-to-swcconfig --output="$TMP_SWCRC"
echo "✅ Successfully converted tsconfig.json to .swcrc"

echo "⚙️  Starting watch mode with nodemon..."
echo "📝 Watching for changes in: $IN_PATH"
echo "🚀 Changes will trigger automatic recompilation and execution"

# Watch for changes in the src directory, compile and run
npx nodemon --quiet \
    --watch "$IN_PATH" \
    --ext '*' \
    --exec "echo '🔄 File change detected, recompiling...' && npx swc $IN_PATH \
        --source-maps \
        --copy-files \
        --config-file $TMP_SWCRC \
        --out-dir $OUT_PATH \
        --strip-leading-paths \
        && echo '✅ Compilation successful, running...' && node --enable-source-maps $OUT_PATH/index.js"
