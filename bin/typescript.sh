#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

# `cd -P` on every hop: under pnpm the package sits behind a symlinked prefix.
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    LINK_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ $SCRIPT_PATH != /* ]] && SCRIPT_PATH="$LINK_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
PACKAGE_ROOT="$SCRIPT_DIR/.."

find_binary() {
    local name="$1"
    if [ -x "$PACKAGE_ROOT/node_modules/.bin/$name" ]; then
        echo "$PACKAGE_ROOT/node_modules/.bin/$name"
    elif [ -x "$PROJECT_ROOT/node_modules/.bin/$name" ]; then
        echo "$PROJECT_ROOT/node_modules/.bin/$name"
    else
        echo "$name"  # Fallback to PATH
    fi
}

# shellcheck source=find-tsc.sh
. "$SCRIPT_DIR/find-tsc.sh"

TSDOWN=$(find_binary tsdown)

# oxlint looks `tsgolint` up on PATH, which a consumer's PATH has no reason to carry.
add_tsgolint_to_path() {
    local tsgolint
    tsgolint=$(find_binary tsgolint)
    case "$tsgolint" in
        */*)
            PATH="$(cd -P "$(dirname "$tsgolint")" && pwd):$PATH"
            export PATH
            ;;
    esac
}

COMMAND="$1"
shift 2>/dev/null || true

run_tsdown() {
    local CONFIG_PATH="$1"
    local LABEL="$2"

    printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} ${LABEL}...\n\n"

    cd "$PROJECT_ROOT"

    # A package with no `exports` naming something under `dist/` keeps the preset's `src/index.ts`.
    local entries=()
    while IFS= read -r entry; do
        [ -n "$entry" ] && entries+=("$entry")
    done < <(node "$PACKAGE_ROOT/lint/engine/project/entry-points.js" "$PROJECT_ROOT")

    if ! "$TSDOWN" --config "$CONFIG_PATH" --cwd "$PROJECT_ROOT" "${entries[@]}"; then
        printf "${RED}Error: Build failed${NC}\n"
        exit 1
    fi

    printf "\n${GREEN}Build completed${NC}\n"
}

case "$COMMAND" in
    build)
        run_tsdown "$SCRIPT_DIR/../src/presets/tsdown/build.js" "Building application (ESM + types)"
        ;;

    bundle)
        run_tsdown "$SCRIPT_DIR/../src/presets/tsdown/bundle.js" "Bundling library (ESM + CJS + types)"
        ;;

    start)
        cd "$PROJECT_ROOT"
        exec node --enable-source-maps dist/index.js "$@"
        ;;

    dev)
        CONFIG_PATH="$SCRIPT_DIR/../src/presets/tsdown/build.js"

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Starting dev mode...\n\n"

        cd "$PROJECT_ROOT"

        "$TSDOWN" --config "$CONFIG_PATH" --cwd "$PROJECT_ROOT" \
            --watch \
            --on-success "node --enable-source-maps dist/index.js"
        ;;

    clean)
        # dist/ is the build's product, published from beside src/, not an artefact.
        cd "$PROJECT_ROOT"

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Removing artefacts...\n\n"

        if [ -d ".artifacts" ]; then
            rm -rf .artifacts
            printf "${GREEN}Removed .artifacts/${NC}\n"
        else
            printf "${GREEN}Nothing to remove — .artifacts/ is already absent${NC}\n"
        fi
        ;;

    docs-layout)
        # For a repository with no npm project to hang `check` on (a Go, Rust or Ansible tree, through npx).
        exec node "$PACKAGE_ROOT/lint/consumer/checks/docs.cli.js" "${1:-$PROJECT_ROOT}"
        ;;

    doctor)
        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Checking the toolchain...\n\n"

        exec node "$PACKAGE_ROOT/src/cli/doctor.js" "$PROJECT_ROOT"
        ;;

    baseline)
        # A command of its own: `fix --baseline` would bury a rewrite of a tracked file in the everyday gesture.
        cd "$PROJECT_ROOT"

        add_tsgolint_to_path

        OXLINT=$(find_binary oxlint)
        # shellcheck source=tool-configs.sh
        . "$SCRIPT_DIR/tool-configs.sh"
        BASELINE_REPORT=$(mktemp)
        trap 'rm -f "$BASELINE_REPORT"' EXIT

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Recording the oxlint baseline...\n\n"

        LINT_TARGETS=()
        LINT_LISTED=true
        LISTED=$(node "$PACKAGE_ROOT/src/cli/lint-targets.js" . "${OXLINT_TARGET_ARGS[@]}" "$@" 2>/dev/null) || LINT_LISTED=false
        while IFS= read -r target; do
            [ -n "$target" ] && LINT_TARGETS+=("$target")
        done <<< "$LISTED"

        if [ "$LINT_LISTED" = true ] && [ ${#LINT_TARGETS[@]} -eq 0 ]; then
            printf '{ "diagnostics": [] }\n' > "$BASELINE_REPORT"
        else
            # oxlint exits non-zero on the very debt this records.
            "$OXLINT" "${OXLINT_CONFIG_ARGS[@]}" --type-aware --format json "$@" "${LINT_TARGETS[@]}" \
                > "$BASELINE_REPORT" 2>/dev/null || true
        fi

        NAMES_REPORT=$(mktemp)
        trap 'rm -f "$BASELINE_REPORT" "$NAMES_REPORT"' EXIT
        node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$PACKAGE_ROOT/lint/consumer/checks/names.js" . --format json "$@" > "$NAMES_REPORT" 2>/dev/null || true

        COMMENTS_REPORT=$(mktemp)
        trap 'rm -f "$BASELINE_REPORT" "$NAMES_REPORT" "$COMMENTS_REPORT"' EXIT
        node "$PACKAGE_ROOT/lint/consumer/checks/comments.js" . --format json "$@" > "$COMMENTS_REPORT" 2>/dev/null || true

        node "$PACKAGE_ROOT/lint/engine/baseline/cli.js" "$BASELINE_REPORT" . \
            --names "$NAMES_REPORT" --comments "$COMMENTS_REPORT" --write || exit 1

        # A tracked file, so the formatter shapes it.
        OXFMT=$(find_binary oxfmt)
        "$OXFMT" "${OXFMT_CONFIG_ARGS[@]}" jterrazz.baseline.json > /dev/null 2>&1 || true
        ;;

    tsc)
        # For emit (`tsc --build`): `tsc` on PATH is whatever the tree hoisted, once TypeScript 5.
        cd "$PROJECT_ROOT"
        exec "$(find_tsc)" "$@"
        ;;

    check|fix)
        exec bash "$SCRIPT_DIR/commands/check.sh" "$COMMAND" "$@"
        ;;

    *)
        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} TypeScript toolchain\n\n"
        printf "Usage: typescript <command>\n\n"
        printf "Commands:\n"
        printf "  build        Build application (ESM + types)\n"
        printf "  bundle       Bundle library (ESM + CJS + types)\n"
        printf "  start        Run the built application\n"
        printf "  dev          Build, run, and rebuild on changes\n"
        printf "  docs-layout  Check a repository's docs/ against the manual spine\n"
        printf "  doctor       Report the installed tool versions against the declared ranges\n"
        printf "  baseline     Record oxlint's own rules, Names and Comments into jterrazz.baseline.json\n"
        printf "  tsc          Run the TypeScript 7 compiler this package ships (emit, --build)\n"
        printf "  check        Check types, lint, formatting, and unused code\n"
        printf "  fix          Auto-fix lint and formatting issues\n"
        printf "  clean        Remove .artifacts/ — dist/ stays, it is the build's product\n\n"
        printf "Examples:\n"
        printf "  typescript build\n"
        printf "  typescript bundle\n"
        printf "  typescript start\n"
        printf "  typescript dev\n"
        printf "  typescript docs-layout .\n"
        printf "  typescript doctor\n"
        printf "  typescript baseline\n"
        printf "  typescript tsc --build\n"
        printf "  typescript check\n"
        printf "  typescript fix\n"
        printf "  typescript clean\n"
        exit 1
        ;;
esac
