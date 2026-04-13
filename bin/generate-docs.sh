#!/bin/bash
# Generate API reference + llms.txt from TypeScript source.
# Called by: typescript docs
#
# Runs typedoc with sensible defaults (no typedoc.json needed),
# then generates llms.txt (index) and llms-full.txt (full reference).

set -e

PROJECT_ROOT="$1"
PACKAGE_ROOT="$2"
OUT_DIR="$PROJECT_ROOT/.docs"

TYPEDOC=$(
    if [ -x "$PACKAGE_ROOT/node_modules/.bin/typedoc" ]; then
        echo "$PACKAGE_ROOT/node_modules/.bin/typedoc"
    elif [ -x "$PROJECT_ROOT/node_modules/.bin/typedoc" ]; then
        echo "$PROJECT_ROOT/node_modules/.bin/typedoc"
    else
        echo "typedoc"
    fi
)

# ── Step 1: Run typedoc ──

"$TYPEDOC" \
    --entryPoints "$PROJECT_ROOT/src/index.ts" \
    --plugin typedoc-plugin-markdown \
    --out "$OUT_DIR" \
    --readme none \
    --entryFileName index.md \
    --hideBreadcrumbs true \
    --hidePageHeader true \
    --outputFileStrategy members \
    --useCodeBlocks true \
    --excludeInternal true \
    --excludePrivate true \
    --excludeProtected true \
    --githubPages false \
    --indexFormat table \
    --parametersFormat table \
    --enumMembersFormat table \
    --typeDeclarationFormat table \
    --tsconfig "$PROJECT_ROOT/tsconfig.json"

# ── Step 2: Read package name ──

PKG_NAME=$(node -e "console.log(require('$PROJECT_ROOT/package.json').name)")
PKG_DESC=$(node -e "console.log(require('$PROJECT_ROOT/package.json').description || '')")

# ── Step 3: Generate llms.txt ──

{
    echo "# $PKG_NAME"
    echo ""
    if [ -n "$PKG_DESC" ]; then
        echo "> $PKG_DESC"
        echo ""
    fi
    echo "## API Reference"
    echo ""
    sed -n '/^## /,$ p' "$OUT_DIR/index.md"
} > "$OUT_DIR/llms.txt"

# ── Step 4: Generate llms-full.txt ──

{
    echo "# $PKG_NAME — Full API Reference"
    echo ""
    if [ -n "$PKG_DESC" ]; then
        echo "> $PKG_DESC"
        echo ""
    fi

    for f in "$OUT_DIR"/index.md \
             "$OUT_DIR"/functions/*.md \
             "$OUT_DIR"/classes/*.md \
             "$OUT_DIR"/interfaces/*.md \
             "$OUT_DIR"/type-aliases/*.md \
             "$OUT_DIR"/variables/*.md; do
        [ -f "$f" ] || continue
        echo "---"
        echo ""
        cat "$f"
        echo ""
    done
} > "$OUT_DIR/llms-full.txt"

echo "Generated $OUT_DIR/llms.txt and $OUT_DIR/llms-full.txt"
