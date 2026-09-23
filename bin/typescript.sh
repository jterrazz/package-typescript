#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

# Get the directory where the script is being called from (caller's project root)
if [ -n "$INIT_CWD" ]; then
    PROJECT_ROOT="$INIT_CWD"
else
    PROJECT_ROOT=$(pwd)
fi

# The PHYSICAL directory this script lives in, symlinks resolved on every hop.
# `cd -P` matters: under pnpm the package sits behind a symlinked prefix, and
# a shim found from the logical path execs a relative target that lands
# beside the wrong parent.
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    LINK_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ $SCRIPT_PATH != /* ]] && SCRIPT_PATH="$LINK_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
PACKAGE_ROOT="$SCRIPT_DIR/.."

# Find binaries - check package's node_modules first, then project's (handles npm hoisting)
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

# oxlint's type-aware rules run in `tsgolint`, a separate binary it looks up on
# PATH — and a consumer's PATH has no reason to carry this package's bin dir. It
# is a dependency here, so the lookup is made to succeed by putting the
# directory that holds it in front, for this process and its children only.
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

# Parse command
COMMAND="$1"
shift 2>/dev/null || true

run_tsdown() {
    local CONFIG_PATH="$1"
    local LABEL="$2"

    printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} ${LABEL}...\n\n"

    cd "$PROJECT_ROOT"

    # What the package publishes is its `exports` map, so the build reads its
    # entries there rather than assuming one. A package with no map, or whose
    # map names nothing under `dist/`, keeps the preset's `src/index.ts`.
    local entries=()
    while IFS= read -r entry; do
        [ -n "$entry" ] && entries+=("$entry")
    done < <(node "$PACKAGE_ROOT/src/cli/entry-points.js" "$PROJECT_ROOT")

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
        # Every tool writes under .artifacts/<tool>/, so removing that one
        # directory is the whole cleanup. dist/ is NOT touched: it is the
        # build's product, published from beside src/, not an artefact.
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
        # The manual's shape, on its own — the same gate `check` runs as its
        # Docs (layout) pass, reachable by a repository that has no npm project
        # to hang it on (a Go, Rust or Ansible tree wiring it into `make lint`
        # through npx). It takes the repository root and needs nothing installed.
        exec node "$PACKAGE_ROOT/src/cli/check-docs.js" "${1:-$PROJECT_ROOT}"
        ;;

    doctor)
        # Cheap, and read-only: what the toolchain is actually running against
        # what it says it needs. No binary is spawned — every version is read
        # off an installed package's own manifest, which is the one place that
        # cannot disagree with what node will load.
        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Checking the toolchain...\n\n"

        exec node "$PACKAGE_ROOT/src/cli/doctor.js" "$PROJECT_ROOT"
        ;;

    baseline)
        # The ratchet, recorded. A command of its own because it neither checks
        # nor repairs: it writes down where the project actually stands, so the
        # oxlint pass can refuse to let that number rise. `fix --baseline` would
        # bury a rewrite of a tracked file inside the everyday gesture. It
        # records this package's rules only: `jterrazz(*)` and the conventions
        # checker's findings are @jterrazz/test's, in its own file.
        cd "$PROJECT_ROOT"

        add_tsgolint_to_path

        OXLINT=$(find_binary oxlint)
        BASELINE_REPORT=$(mktemp)
        trap 'rm -f "$BASELINE_REPORT"' EXIT

        printf "${CYAN_BG}${BRIGHT_WHITE} TYPESCRIPT ${NC} Recording the oxlint baseline...\n\n"

        # The files `check` hands the linter — the project's files it parses —
        # so the file records what `check` reports. An empty list records
        # nothing; a sweep that could not answer hands oxlint the directory.
        LINT_TARGETS=()
        LINT_LISTED=true
        LISTED=$(node "$PACKAGE_ROOT/src/cli/lint-targets.js" . "$@" 2>/dev/null) || LINT_LISTED=false
        while IFS= read -r target; do
            [ -n "$target" ] && LINT_TARGETS+=("$target")
        done <<< "$LISTED"

        # A non-zero exit is the whole point of the recording, not a failure.
        if [ "$LINT_LISTED" = true ] && [ ${#LINT_TARGETS[@]} -eq 0 ]; then
            printf '{ "diagnostics": [] }\n' > "$BASELINE_REPORT"
        else
            "$OXLINT" --type-aware --format json "$@" "${LINT_TARGETS[@]}" \
                > "$BASELINE_REPORT" 2>/dev/null || true
        fi

        # The Names (tree) pass's findings take the same file, under `names/`:
        # that pass reads its own entries back, so a construct name a project
        # has not renamed yet is recorded debt rather than a red run.
        NAMES_REPORT=$(mktemp)
        trap 'rm -f "$BASELINE_REPORT" "$NAMES_REPORT"' EXIT
        node "$PACKAGE_ROOT/src/cli/check-names.js" . --format json "$@" > "$NAMES_REPORT" 2>/dev/null || true

        node "$PACKAGE_ROOT/src/cli/check-baseline.js" "$BASELINE_REPORT" . \
            --names "$NAMES_REPORT" --write

        # The file is tracked, so it is the formatter's like every other tracked
        # file — written here, shaped by the project's own oxfmt, never both.
        OXFMT=$(find_binary oxfmt)
        "$OXFMT" typescript.baseline.json > /dev/null 2>&1 || true
        ;;

    tsc)
        # The compiler itself, for the one thing `check` cannot do: EMIT. A
        # repository built with project references runs `tsc --build`, and
        # without this it reaches for `tsc` on PATH — whatever version the tree
        # hoisted, which is how a package that dropped its own `typescript`
        # dependency silently compiled against TypeScript 5.
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
        printf "  baseline     Record oxlint's own rules and Names into typescript.baseline.json\n"
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
