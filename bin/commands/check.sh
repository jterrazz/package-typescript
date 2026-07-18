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

# Type checking uses the official TypeScript 7 Go compiler, pulled in through
# the per-platform @typescript/typescript-* packages instead of a second
# package named "typescript": typedoc and eslint-plugin-perfectionist load
# the JS API from the "typescript" name (v6 here), and any typescript@7 in
# the tree can hijack that lookup under pnpm's hoist fallback.
find_tsc() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="darwin" ;;
        Linux) os="linux" ;;
        MINGW*|MSYS*|CYGWIN*) os="win32" ;;
        *) os="linux" ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch="arm64" ;;
        armv7l) arch="arm" ;;
        *) arch="x64" ;;
    esac

    local pkg="@typescript/typescript-$os-$arch"
    if [ -x "$PACKAGE_ROOT/node_modules/$pkg/lib/tsc" ]; then
        echo "$PACKAGE_ROOT/node_modules/$pkg/lib/tsc"
    elif [ -x "$PACKAGE_ROOT/../../$pkg/lib/tsc" ]; then
        echo "$PACKAGE_ROOT/../../$pkg/lib/tsc"
    else
        find_binary tsc
    fi
}

TSC=$(find_tsc)
OXLINT=$(find_binary oxlint)
OXFMT=$(find_binary oxfmt)
KNIP=$(find_binary knip)
CHECKER=$(find_binary jterrazz-test-check)

# The @jterrazz/test conventions checker (D4 tokens, C8/C9 fixtures) runs only when the
# consuming project depends on @jterrazz/test — auto-detected from its package.json.
project_uses_jterrazz_test() {
    [ -f "package.json" ] || return 1
    node -e 'const p=require("./package.json");const d={...p.dependencies,...p.devDependencies,...p.peerDependencies};process.exit(d["@jterrazz/test"]?0:1)' 2>/dev/null
}

# The @jterrazz/test oxlint plugin is ESM-only. A CommonJS oxlint config silently drops
# it (oxlint prints a load warning and still exits 0) — none of the jterrazz/* rules run.
# Warn loudly when that pitfall is detectable.
warn_cjs_oxlint_config() {
    local cfg=""
    for c in oxlint.config.ts oxlint.config.mjs oxlint.config.cjs oxlint.config.js; do
        [ -f "$c" ] && { cfg="$c"; break; }
    done
    [ -z "$cfg" ] && return 0

    local is_cjs=false
    case "$cfg" in
        *.cjs) is_cjs=true ;;
        *.js)
            if ! node -e 'process.exit(require("./package.json").type==="module"?0:1)' 2>/dev/null; then
                is_cjs=true
            fi
            ;;
    esac

    if [ "$is_cjs" = true ]; then
        printf "${RED} WARNING ${NC} @jterrazz/test is installed but %s is CommonJS.\n" "$cfg"
        printf "          The @jterrazz/test oxlint plugin is ESM-only and will be SILENTLY DROPPED —\n"
        printf "          none of the jterrazz/* rules will run. Switch to an ESM config (oxlint.config.ts or .mjs).\n\n"
    fi
}

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

    if project_uses_jterrazz_test; then
        warn_cjs_oxlint_config
    fi

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

    # Conventions checker: only in check mode, only when the project uses @jterrazz/test
    # and has a specs/ directory to validate.
    local checker_pid=""
    local checker_status=0
    if [ "$FIX_MODE" = false ] && [ -d "specs" ] && project_uses_jterrazz_test; then
        "$CHECKER" specs > "$tmp_dir/checker.log" 2>&1 &
        checker_pid=$!
    fi

    # Docs (sync): only in check mode, and only once the project has generated
    # its committed docs (docs/reference/ exists — opt-in by first generation).
    # Delegates to docs.sh --check: regenerate into a temp dir, diff the
    # committed projections. Never duplicates the compiler's logic.
    local docs_pid=""
    local docs_status=0
    if [ "$FIX_MODE" = false ] && [ -d "docs/reference" ]; then
        bash "$SCRIPT_DIR/docs.sh" "$(pwd)" "$PACKAGE_ROOT" --check > "$tmp_dir/docs.log" 2>&1 &
        docs_pid=$!
    fi

    # Wait and collect statuses
    wait $type_pid;   local type_status=$?
    wait $lint_pid;   local lint_status=$?
    wait $format_pid; local format_status=$?
    [ -n "$knip_pid" ] && { wait $knip_pid; knip_status=$?; }
    [ -n "$checker_pid" ] && { wait $checker_pid; checker_status=$?; }
    [ -n "$docs_pid" ] && { wait $docs_pid; docs_status=$?; }

    # Print results — quiet on success, verbose on failure: a tool's captured log
    # is shown only when it failed, so green output stays byte-identical across
    # platforms (some tool builds print success chatter on Linux but not macOS).
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} TypeScript Check\n\n"
    if [ $type_status -ne 0 ]; then
        [ -s "$tmp_dir/type.log" ] && cat "$tmp_dir/type.log"
        printf "${RED}✗ Failed with exit code %d${NC}\n" $type_status
    else
        printf "${GREEN}✓ Passed${NC}\n"
    fi

    local lint_label="Oxlint Check"
    [ "$FIX_MODE" = true ] && lint_label="Oxlint Fix"
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} ${lint_label}\n\n"
    if [ $lint_status -ne 0 ]; then
        [ -s "$tmp_dir/lint.log" ] && cat "$tmp_dir/lint.log"
        printf "${RED}✗ Failed with exit code %d${NC}\n" $lint_status
    else
        printf "${GREEN}✓ Passed${NC}\n"
    fi

    local format_label="Oxfmt Check"
    [ "$FIX_MODE" = true ] && format_label="Oxfmt Format"
    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} ${format_label}\n\n"
    if [ $format_status -ne 0 ]; then
        [ -s "$tmp_dir/format.log" ] && cat "$tmp_dir/format.log"
        printf "${RED}✗ Failed with exit code %d${NC}\n" $format_status
    else
        printf "${GREEN}✓ Passed${NC}\n"
    fi

    if [ "$FIX_MODE" = false ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Knip (unused code)\n\n"
        if [ $knip_status -ne 0 ]; then
            [ -s "$tmp_dir/knip.log" ] && cat "$tmp_dir/knip.log"
            printf "${RED}✗ Failed with exit code %d${NC}\n" $knip_status
        else
            printf "${GREEN}✓ Passed${NC}\n"
        fi

        if [ -n "$checker_pid" ]; then
            printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Test Conventions (@jterrazz/test)\n\n"
            if [ $checker_status -ne 0 ]; then
                [ -s "$tmp_dir/checker.log" ] && cat "$tmp_dir/checker.log"
                printf "${RED}✗ Failed with exit code %d${NC}\n" $checker_status
            else
                printf "${GREEN}✓ Passed${NC}\n"
            fi
        fi

        if [ -n "$docs_pid" ]; then
            printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Docs (sync)\n\n"
            if [ $docs_status -ne 0 ]; then
                [ -s "$tmp_dir/docs.log" ] && cat "$tmp_dir/docs.log"
                printf "${RED}✗ Failed with exit code %d${NC}\n" $docs_status
            else
                printf "${GREEN}✓ Passed${NC}\n"
            fi
        fi
    fi

    # Summary
    if [ "$FIX_MODE" = true ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality fixes\n\n"
    else
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality checks\n\n"
    fi

    if [ $type_status -eq 0 ] && [ $lint_status -eq 0 ] && [ $format_status -eq 0 ] && [ $knip_status -eq 0 ] && [ $checker_status -eq 0 ] && [ $docs_status -eq 0 ]; then
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
