#!/bin/bash
# Quality checks: runs tsc, oxlint, oxfmt, and knip in parallel.
# Called by: typescript check | typescript fix

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

# Resolve symlinks to get the real script location
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
PACKAGE_ROOT="$SCRIPT_DIR/../.."

# Find binaries one by one - npm may hoist some tools to the consumer's
# node_modules/.bin and nest others under this package, so a single shared
# bin directory cannot be assumed
find_binary() {
    local name="$1"
    if [ -x "$PACKAGE_ROOT/node_modules/.bin/$name" ]; then
        echo "$PACKAGE_ROOT/node_modules/.bin/$name"
    elif [ -x "$PACKAGE_ROOT/../../.bin/$name" ]; then
        echo "$PACKAGE_ROOT/../../.bin/$name"
    else
        echo "$name"  # Fallback to PATH
    fi
}

# The Go compiler (official typescript@7) is installed under the
# "typescript-go" npm alias: typedoc and eslint-plugin-perfectionist need the
# JS-API typescript 5/6 to resolve under the name "typescript", so the two
# must coexist. Resolve the aliased package's binary directly — both packages
# link a `tsc` bin, so .bin/tsc would be ambiguous.
find_tsc() {
    if [ -x "$PACKAGE_ROOT/node_modules/typescript-go/bin/tsc" ]; then
        echo "$PACKAGE_ROOT/node_modules/typescript-go/bin/tsc"
    elif [ -x "$PACKAGE_ROOT/../../typescript-go/bin/tsc" ]; then
        echo "$PACKAGE_ROOT/../../typescript-go/bin/tsc"
    else
        find_binary tsc
    fi
}

TSC=$(find_tsc)
OXLINT=$(find_binary oxlint)
OXFMT=$(find_binary oxfmt)
KNIP=$(find_binary knip)

# Parse command and args
COMMAND=""
LINT_ARGS=()

if [[ "${1:-}" == -* ]] || [ -z "${1:-}" ]; then
    # No command, everything is args
    true
else
    COMMAND="$1"
    shift
fi

# Parse remaining args
while [[ $# -gt 0 ]]; do
    case $1 in
        --ignore-pattern)
            LINT_ARGS+=("$1" "$2")
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Create a temporary directory for log files
tmp_dir=$(mktemp -d)
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

run_checks() {
    local FIX_MODE="$1"
    local LABEL

    if [ "$FIX_MODE" = true ]; then
        LABEL="Running quality fixes"
    else
        LABEL="Running quality checks"
    fi

    printf "${CYAN_BG}${BRIGHT_WHITE} START ${NC} ${LABEL}\n"

    # Run all tools in parallel
    "$TSC" --noEmit > "$tmp_dir/type.log" 2>&1 &
    local type_pid=$!

    if [ "$FIX_MODE" = true ]; then
        "$OXLINT" --fix "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    else
        "$OXLINT" "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    fi
    local lint_pid=$!

    if [ "$FIX_MODE" = true ]; then
        "$OXFMT" > "$tmp_dir/format.log" 2>&1 &
    else
        "$OXFMT" --check > "$tmp_dir/format.log" 2>&1 &
    fi
    local format_pid=$!

    # Knip: only run in check mode (fix mode is destructive)
    # Merge base config (from this package) with optional project-local knip.json
    local knip_pid=""
    local knip_status=0
    if [ "$FIX_MODE" = false ]; then
        local knip_base="$PACKAGE_ROOT/presets/knip/base.json"
        local knip_project=""
        [ -f "knip.json" ] && knip_project="knip.json"
        [ -f "knip.jsonc" ] && knip_project="knip.jsonc"

        node "$PACKAGE_ROOT/lib/merge-knip-config.js" "$knip_base" $knip_project > "$tmp_dir/knip-merged.json"
        "$KNIP" --no-progress --no-config-hints --config "$tmp_dir/knip-merged.json" > "$tmp_dir/knip.log" 2>&1 &
        knip_pid=$!
    fi

    # Wait and collect statuses
    wait $type_pid;   local type_status=$?
    wait $lint_pid;   local lint_status=$?
    wait $format_pid; local format_status=$?
    [ -n "$knip_pid" ] && { wait $knip_pid; knip_status=$?; }

    # Print results
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} TypeScript Check\n\n"
    [ -s "$tmp_dir/type.log" ] && cat "$tmp_dir/type.log"
    [ $type_status -ne 0 ] && printf "${RED}✗ Failed with exit code %d${NC}\n" $type_status || printf "${GREEN}✓ Passed${NC}\n"

    local lint_label="Oxlint Check"
    [ "$FIX_MODE" = true ] && lint_label="Oxlint Fix"
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} ${lint_label}\n\n"
    [ -s "$tmp_dir/lint.log" ] && cat "$tmp_dir/lint.log"
    [ $lint_status -ne 0 ] && printf "${RED}✗ Failed with exit code %d${NC}\n" $lint_status || printf "${GREEN}✓ Passed${NC}\n"

    local format_label="Oxfmt Check"
    [ "$FIX_MODE" = true ] && format_label="Oxfmt Format"
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} ${format_label}\n\n"
    [ -s "$tmp_dir/format.log" ] && cat "$tmp_dir/format.log"
    [ $format_status -ne 0 ] && printf "${RED}✗ Failed with exit code %d${NC}\n" $format_status || printf "${GREEN}✓ Passed${NC}\n"

    if [ "$FIX_MODE" = false ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Knip (unused code)\n\n"
        [ -s "$tmp_dir/knip.log" ] && cat "$tmp_dir/knip.log"
        [ $knip_status -ne 0 ] && printf "${RED}✗ Failed with exit code %d${NC}\n" $knip_status || printf "${GREEN}✓ Passed${NC}\n"
    fi

    # Summary
    if [ "$FIX_MODE" = true ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality fixes\n\n"
    else
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality checks\n\n"
    fi

    if [ $type_status -eq 0 ] && [ $lint_status -eq 0 ] && [ $format_status -eq 0 ] && [ $knip_status -eq 0 ]; then
        printf "${GREEN}✓ All checks passed${NC}\n"
        exit 0
    else
        printf "${RED}✗ Some checks failed${NC}\n"
        exit 1
    fi
}

case "$COMMAND" in
    check)
        run_checks false
        ;;

    fix)
        run_checks true
        ;;

    *)
        printf "Usage: check.sh <check|fix> [--ignore-pattern <pattern>]\n"
        exit 1
        ;;
esac
