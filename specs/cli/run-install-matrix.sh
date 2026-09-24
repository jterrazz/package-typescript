#!/bin/bash
# Test helper: one consumer per profile, installed the way pnpm installs, and
# `typescript check` run in each. The store holds the package and its own
# dependencies; a consumer's own node_modules holds only what its manifest
# declares — so a config reaching for anything else fails here, as it would
# in a real strict install.
# Usage: run-install-matrix.sh
set -e

PACKAGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONSUMERS="$PACKAGE_ROOT/specs/cli/preset/fixtures/install-matrix"
ASTRO_PACKAGE="$PACKAGE_ROOT/specs/cli/preset/fixtures/astro-package"

# perfectionist sorts the specifiers inside one import statement, and a
# consumer's config is linted like everything else it writes.
named_imports() {
    printf '%s\n' "$@" | LC_ALL=C sort -f | paste -sd, - | sed 's/,/, /g'
}

SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/install-matrix-XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

# The store: the package as published (its `files`), the manifest carrying its
# exports, and the package's own dependencies BESIDE it — every one of them,
# because `check` spawns tools the manifest lists as optional too, and a
# half-built store would prove the toolchain broken rather than the config.
# `with-astro` adds the stand-in: the astro preset extends Astro's tsconfig,
# and tsc resolves that name walking up from the package's real path. pnpm's
# store sits inside the consumer's node_modules, so the walk reaches the
# consumer's astro; this store sits beside the consumer, so a link stands
# where the walk looks — in the one store the astro consumers use, so no
# other consumer can resolve it.
build_store() {
    local root="$1" astro="$2"
    local store="$root/.pnpm/@jterrazz+typescript/node_modules"
    local pkg="$store/@jterrazz/typescript"
    mkdir -p "$pkg"
    cp -R "$PACKAGE_ROOT/bin" "$PACKAGE_ROOT/lint" "$PACKAGE_ROOT/src" "$pkg/"
    cp "$PACKAGE_ROOT/package.json" "$pkg/package.json"

    local installed name scoped
    for installed in "$PACKAGE_ROOT"/node_modules/*; do
        name=${installed##*/}
        case "$name" in
            .* | @jterrazz) continue ;;
            @*)
                mkdir -p "$store/$name"
                for scoped in "$installed"/*; do
                    ln -sfn "$scoped" "$store/$name/${scoped##*/}"
                done
                ;;
            *) ln -sfn "$installed" "$store/$name" ;;
        esac
    done
    ln -sfn "$PACKAGE_ROOT/node_modules/.bin" "$store/.bin"
    [ "$astro" = with-astro ] && ln -sfn "$ASTRO_PACKAGE" "$store/astro"
    printf '%s\n' "$pkg"
}

PKG=$(build_store "$SANDBOX/store" without-astro)
ASTRO_PKG=$(build_store "$SANDBOX/astro-store" with-astro)

# Every consumer is laid out and proved strict first, then all of them are
# checked at once: the checks share nothing but the read-only stores.
names=()
packages=()
for consumer in "$CONSUMERS"/*/; do
    name=$(basename "$consumer")
    profile=${name%%-*}
    project="$SANDBOX/$name"
    mkdir -p "$project/node_modules/@jterrazz"
    cp -R "$consumer". "$project/"

    # The links the consumer's own manifest earns, and nothing else
    package="$PKG"
    if grep -q '"astro"' "$project/package.json"; then
        package="$ASTRO_PKG"
        ln -sfn "$ASTRO_PACKAGE" "$project/node_modules/astro"
        mkdir -p "$project/node_modules/.bin"
        ln -sfn "$ASTRO_PACKAGE/bin/astro.js" "$project/node_modules/.bin/astro"
    fi
    ln -sfn "$package" "$project/node_modules/@jterrazz/typescript"
    mkdir -p "$project/node_modules/@types"
    ln -sfn "$PACKAGE_ROOT/node_modules/@types/node" "$project/node_modules/@types/node"
    ln -sfn "$PACKAGE_ROOT/node_modules/vitest" "$project/node_modules/vitest"

    # The two config files are WRITTEN here, not committed with the consumer:
    # oxlint discovers every `oxlint.config.*` under this repository, fixture
    # trees included, and a config importing `@jterrazz/typescript` resolves to
    # nothing from a fixture's own directory. Writing them is also how
    # `run-strict-install.sh` states the documented form, in one place.
    cat > "$project/oxlint.config.ts" <<EOF
import { $(named_imports defineConfig "$profile") } from '@jterrazz/typescript/oxlint';

export default defineConfig($profile);
EOF
    cat > "$project/oxfmt.config.ts" <<'EOF'
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig(base);
EOF

    # Strict is the whole claim: a tool the consumer never declared must not
    # resolve from its root, or a green check below says nothing.
    for tool in oxlint oxfmt knip; do
        if (cd "$project" && node --input-type=module -e "await import('$tool')" > /dev/null 2>&1); then
            echo "not a strict layout: $tool resolves from the $name consumer"
            exit 1
        fi
    done

    names+=("$name")
    packages+=("$package")
done

pids=()
for index in "${!names[@]}"; do
    name=${names[$index]}
    (cd "$SANDBOX/$name" && bash "${packages[$index]}/bin/typescript.sh" check > "$SANDBOX/$name.log" 2>&1) &
    pids+=($!)
done

failed=0
for index in "${!names[@]}"; do
    name=${names[$index]}
    if wait "${pids[$index]}"; then
        echo "checked: $name"
    else
        echo "FAILED: $name"
        cat "$SANDBOX/$name.log"
        failed=1
    fi
done
exit $failed
