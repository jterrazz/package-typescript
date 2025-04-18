#!/bin/bash

# Exit on error
set -e

# Get the directory where the script is being called from (caller's project root)
# If called through bin, we need to get the directory where the command was executed
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

echo "🚀 Starting TypeScript compilation process..."

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

# Create typescript declaration files
echo "📝 Generating TypeScript declaration files..."
npx tsc --rootDir "$IN_PATH" --declaration --emitDeclarationOnly --outDir "$OUT_PATH"
echo "✅ TypeScript declaration files generated"

# Create javascript ESM files with improved source maps
echo "⚙️  Compiling TypeScript to ESM with source maps..."
if ! "$PROJECT_ROOT/node_modules/.bin/swc" "$IN_PATH" \
    --source-maps \
    --copy-files \
    --config-file "$TMP_SWCRC" \
    --out-dir "$OUT_PATH" \
    --strip-leading-paths \
    --log-watch-compilation \
    "$@"; then
    echo "❌ SWC compilation failed"
    exit 1
fi
echo "✅ ESM compilation completed"

# Create javascript CJS files
echo "🔄 Creating CommonJS bundle..."
if ! npx rollup "$OUT_PATH/index.js" --format cjs --file "$OUT_PATH/index.cjs" --silent; then
    echo "❌ Rollup bundling failed"
    exit 1
fi
echo "✅ CommonJS bundle created"

echo "✨ Compilation process completed successfully!"