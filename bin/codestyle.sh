#!/bin/bash

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
PACKAGE_ROOT="$SCRIPT_DIR/.."

# Find bin directory
if [ -x "$PACKAGE_ROOT/../../.bin/oxlint" ]; then
    BIN_DIR="$PACKAGE_ROOT/../../.bin"
elif [ -x "$PACKAGE_ROOT/node_modules/.bin/oxlint" ]; then
    BIN_DIR="$PACKAGE_ROOT/node_modules/.bin"
else
    BIN_DIR="$(npm bin 2>/dev/null)"
fi

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

    # Run all three in parallel
    "$BIN_DIR/tsgo" --noEmit > "$tmp_dir/type.log" 2>&1 &
    local type_pid=$!

    if [ "$FIX_MODE" = true ]; then
        "$BIN_DIR/oxlint" --fix "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    else
        "$BIN_DIR/oxlint" "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    fi
    local lint_pid=$!

    if [ "$FIX_MODE" = true ]; then
        "$BIN_DIR/oxfmt" > "$tmp_dir/format.log" 2>&1 &
    else
        "$BIN_DIR/oxfmt" --check > "$tmp_dir/format.log" 2>&1 &
    fi
    local format_pid=$!

    # Wait and collect statuses
    wait $type_pid;   local type_status=$?
    wait $lint_pid;   local lint_status=$?
    wait $format_pid; local format_status=$?

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

    # Summary
    if [ "$FIX_MODE" = true ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality fixes\n\n"
    else
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality checks\n\n"
    fi

    if [ $type_status -eq 0 ] && [ $lint_status -eq 0 ] && [ $format_status -eq 0 ]; then
        printf "${GREEN}✓ All checks passed${NC}\n"
        exit 0
    else
        printf "${RED}✗ Some checks failed${NC}\n"
        exit 1
    fi
}

case "$COMMAND" in
    fix)
        run_checks true
        ;;

    ""|check)
        run_checks false
        ;;

    *)
        printf "${CYAN_BG}${BRIGHT_WHITE} CODESTYLE ${NC} Code quality toolkit\n\n"
        printf "Usage: codestyle [command]\n\n"
        printf "Commands:\n"
        printf "  (default)    Check types, lint, and formatting\n"
        printf "  fix          Auto-fix lint and formatting issues\n\n"
        printf "Examples:\n"
        printf "  codestyle\n"
        printf "  codestyle fix\n"
        exit 1
        ;;
esac
