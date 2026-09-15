#!/bin/bash
# Test helper: one consumer per profile, installed the way pnpm installs, and
# `typescript check` run in each. The store holds the package and its own
# dependencies; a consumer's own node_modules holds only what its manifest
# declares — so a config reaching for anything else fails here, as it would
# in a real strict install.
# Usage: run-install-matrix.sh
set -e

PACKAGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONSUMERS="$PACKAGE_ROOT/specs/cli/preset/_fixtures/install-matrix"

SANDBOX=$(mktemp -d -t install-matrix-XXXXXX)
trap 'rm -rf "$SANDBOX"' EXIT

STORE="$SANDBOX/.pnpm/@jterrazz+typescript/node_modules"
PKG="$STORE/@jterrazz/typescript"
mkdir -p "$PKG" "$STORE/@jterrazz"

# The package as published (its `files`), plus the manifest carrying its exports
cp -R "$PACKAGE_ROOT/bin" "$PACKAGE_ROOT/lib" "$PACKAGE_ROOT/presets" \
    "$PACKAGE_ROOT/rules" "$PACKAGE_ROOT/src" "$PKG/"
cp "$PACKAGE_ROOT/package.json" "$PKG/package.json"

# The package's own dependencies, in the store BESIDE it — every one of them,
# because `check` spawns tools the manifest lists as optional too, and a
# half-built store would prove the toolchain broken rather than the config.
for installed in "$PACKAGE_ROOT"/node_modules/*; do
    name=$(basename "$installed")
    case "$name" in
        .* | @jterrazz) continue ;;
        @*)
            mkdir -p "$STORE/$name"
            for scoped in "$installed"/*; do
                ln -sfn "$scoped" "$STORE/$name/$(basename "$scoped")"
            done
            ;;
        *) ln -sfn "$installed" "$STORE/$name" ;;
    esac
done
ln -sfn "$PACKAGE_ROOT/node_modules/.bin" "$STORE/.bin"

for consumer in "$CONSUMERS"/*/; do
    profile=$(basename "$consumer")
    project="$SANDBOX/$profile"
    mkdir -p "$project/node_modules/@jterrazz"
    cp -R "$consumer". "$project/"

    # The links the consumer's own manifest earns, and nothing else
    ln -sfn "$PKG" "$project/node_modules/@jterrazz/typescript"
    mkdir -p "$project/node_modules/@types"
    ln -sfn "$PACKAGE_ROOT/node_modules/@types/node" "$project/node_modules/@types/node"
    ln -sfn "$PACKAGE_ROOT/node_modules/vitest" "$project/node_modules/vitest"

    cd "$project"

    # Strict is the whole claim: a tool the consumer never declared must not
    # resolve from its root, or a green check below says nothing.
    for tool in oxlint oxfmt knip; do
        if node --input-type=module -e "await import('$tool')" > /dev/null 2>&1; then
            echo "not a strict layout: $tool resolves from the $profile consumer"
            exit 1
        fi
    done

    if bash "$PKG/bin/typescript.sh" check > "$SANDBOX/$profile.log" 2>&1; then
        echo "checked: $profile"
    else
        echo "FAILED: $profile"
        cat "$SANDBOX/$profile.log"
        exit 1
    fi
done
