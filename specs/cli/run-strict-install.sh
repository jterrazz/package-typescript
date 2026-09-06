#!/bin/bash
# Test helper: simulates pnpm's STRICT node_modules. The consumer declares one
# devDependency, so its own node_modules holds @jterrazz/typescript and nothing
# else — the toolchain's dependencies (oxlint, oxfmt, …) live beside the package
# in the virtual store, reachable from it and from nowhere in the project.
# The consumer's configs are the documented ones, importing the package alone.
# Usage: run-strict-install.sh

set -e

PACKAGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SANDBOX=$(mktemp -d -t strict-install-XXXXXX)
trap 'rm -rf "$SANDBOX"' EXIT

STORE="$SANDBOX/node_modules/.pnpm/@jterrazz+typescript/node_modules"
PKG="$STORE/@jterrazz/typescript"
mkdir -p "$PKG" "$STORE/.bin" "$SANDBOX/node_modules/@jterrazz" "$SANDBOX/src"

# The package as published (its `files`), plus the manifest carrying its exports
cp -R "$PACKAGE_ROOT/bin" "$PACKAGE_ROOT/lib" "$PACKAGE_ROOT/presets" "$PACKAGE_ROOT/src" "$PKG/"
cp "$PACKAGE_ROOT/package.json" "$PKG/package.json"

# The single link the consumer's manifest earns
ln -s "$PKG" "$SANDBOX/node_modules/@jterrazz/typescript"

# ...and the package's own dependencies, in the store beside it — never above
while IFS= read -r dep; do
    [ -n "$dep" ] || continue
    [ -e "$PACKAGE_ROOT/node_modules/$dep" ] || continue
    mkdir -p "$STORE/$(dirname "$dep")"
    ln -s "$PACKAGE_ROOT/node_modules/$dep" "$STORE/$dep"
done < <(node -e 'const p=require(process.argv[1]);process.stdout.write(Object.keys(p.dependencies).join("\n"))' "$PACKAGE_ROOT/package.json")

for binary in oxlint oxfmt; do
    ln -s "$PACKAGE_ROOT/node_modules/.bin/$binary" "$STORE/.bin/$binary"
done

cat > "$SANDBOX/package.json" <<'EOF'
{
    "name": "strict-consumer",
    "version": "1.0.0",
    "type": "module",
    "devDependencies": { "@jterrazz/typescript": "*" }
}
EOF

cat > "$SANDBOX/oxlint.config.ts" <<'EOF'
import { defineConfig, node } from '@jterrazz/typescript/oxlint';

export default defineConfig({ extends: [node] });
EOF

cat > "$SANDBOX/oxfmt.config.ts" <<'EOF'
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig(base);
EOF

cat > "$SANDBOX/src/index.ts" <<'EOF'
export const answer = 42;
EOF

cd "$SANDBOX"

# The layout is only a proof if it is really strict: a tool the consumer never
# declared must not resolve from its root, or every claim below is vacuous.
for tool in oxlint oxfmt; do
    if node --input-type=module -e "await import('$tool')" > /dev/null 2>&1; then
        echo "not a strict layout: $tool resolves from the consumer root"
        exit 1
    fi
    echo "unreachable from the consumer root: $tool"
done

"$STORE/.bin/oxlint" --silent src
echo "loaded: oxlint.config.ts"

"$STORE/.bin/oxfmt" --check src > /dev/null
echo "loaded: oxfmt.config.ts"
