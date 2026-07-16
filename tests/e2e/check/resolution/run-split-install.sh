#!/bin/bash
# Test helper: simulates an npm install where oxlint is nested under
# @jterrazz/typescript's own node_modules while the other tools are hoisted
# to the consumer's node_modules/.bin. Each binary must resolve independently.
# Usage: run-split-install.sh <package-root>

set -e

PACKAGE_ROOT="$1"

SANDBOX=$(mktemp -d -t split-install-XXXXXX)
trap 'rm -rf "$SANDBOX"' EXIT

PKG="$SANDBOX/node_modules/@jterrazz/typescript"
mkdir -p "$PKG/node_modules/.bin" "$SANDBOX/node_modules/.bin"

# Install the package files (scripts resolve paths relative to themselves)
cp -R "$PACKAGE_ROOT/bin" "$PKG/bin"
cp -R "$PACKAGE_ROOT/lib" "$PKG/lib"
cp -R "$PACKAGE_ROOT/presets" "$PKG/presets"

# Stub tools hoisted at the consumer root...
for tool in tsgo oxfmt knip; do
    printf '#!/bin/sh\necho "%s-stub-ran"\n' "$tool" > "$SANDBOX/node_modules/.bin/$tool"
    chmod +x "$SANDBOX/node_modules/.bin/$tool"
done

# ...except oxlint, nested under the package itself
printf '#!/bin/sh\necho "oxlint-stub-ran"\n' > "$PKG/node_modules/.bin/oxlint"
chmod +x "$PKG/node_modules/.bin/oxlint"

cd "$SANDBOX"
exec bash "$PKG/bin/commands/check.sh" check
