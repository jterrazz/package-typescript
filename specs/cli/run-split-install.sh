#!/bin/bash
# oxlint nested under the package while the other tools are hoisted: each binary must resolve on its own.

set -e

PACKAGE_ROOT="$1"

SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/split-install-XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

PKG="$SANDBOX/node_modules/@jterrazz/typescript"
mkdir -p "$PKG/node_modules/.bin" "$SANDBOX/node_modules/.bin"

cp -R "$PACKAGE_ROOT/bin" "$PKG/bin"
cp -R "$PACKAGE_ROOT/lint" "$PKG/lint"
cp -R "$PACKAGE_ROOT/src" "$PKG/src"
cp "$PACKAGE_ROOT/package.json" "$PKG/package.json"

for tool in tsc oxfmt knip; do
    printf '#!/bin/sh\necho "%s-stub-ran"\n' "$tool" > "$SANDBOX/node_modules/.bin/$tool"
    chmod +x "$SANDBOX/node_modules/.bin/$tool"
done

# oxlint answers with the empty report the ratchet reads.
printf '#!/bin/sh\necho '"'"'{ "diagnostics": [] }'"'"'\n' > "$PKG/node_modules/.bin/oxlint"
chmod +x "$PKG/node_modules/.bin/oxlint"

cd "$SANDBOX"
exec bash "$PKG/bin/commands/check.sh" check
