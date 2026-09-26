#!/bin/bash
# A consumer's node_modules holds only what its manifest declares, as under pnpm: a config reaching further fails here.
set -e

PACKAGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONSUMERS="$PACKAGE_ROOT/specs/cli/preset/_fixtures/install-matrix"
ASTRO_PACKAGE="$PACKAGE_ROOT/specs/cli/preset/_fixtures/astro-package"

# perfectionist sorts the specifiers inside one import, and a consumer's config is linted too.
named_imports() {
    printf '%s\n' "$@" | LC_ALL=C sort -f | paste -sd, - | sed 's/,/, /g'
}

SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/install-matrix-XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

# Every dependency beside the package: `check` spawns optional ones too. The astro preset extends Astro's
# tsconfig, resolved walking up from the package's real path, so the astro store links a stand-in there.
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

names=()
packages=()
for consumer in "$CONSUMERS"/*/; do
    name=$(basename "$consumer")
    profile=${name%%-*}
    project="$SANDBOX/$name"
    mkdir -p "$project/node_modules/@jterrazz"
    cp -R "$consumer". "$project/"

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

    # Written, not committed: oxlint discovers every `oxlint.config.*` under this repository, fixtures included.
    cat > "$project/oxlint.config.ts" <<EOF
import { $(named_imports defineConfig "$profile") } from '@jterrazz/typescript/oxlint';

export default defineConfig($profile);
EOF
    cat > "$project/oxfmt.config.ts" <<'EOF'
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig(base);
EOF

    # Strict is the whole claim: an undeclared tool resolving from the root would make the check below say nothing.
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
