#!/bin/bash
# Test helper: merges knip config and runs knip in the current directory.
# Usage: run-knip.sh <package-root>
#
# This mimics the knip portion of check.sh for isolated testing.

PACKAGE_ROOT="$1"
KNIP_BASE="$PACKAGE_ROOT/presets/knip/base.json"
KNIP_BIN="$PACKAGE_ROOT/node_modules/.bin/knip"
MERGE_SCRIPT="$PACKAGE_ROOT/bin/merge-knip-config.js"

# Find project-local knip config (if any)
KNIP_PROJECT=""
[ -f "knip.json" ] && KNIP_PROJECT="knip.json"
[ -f "knip.jsonc" ] && KNIP_PROJECT="knip.jsonc"

# Merge configs into a temp file
MERGED=$(mktemp -t knip-merged-XXXXXX).json
trap "rm -f $MERGED" EXIT
node "$MERGE_SCRIPT" "$KNIP_BASE" $KNIP_PROJECT > "$MERGED"

# Run knip with merged config
"$KNIP_BIN" --no-progress --no-config-hints --config "$MERGED"
