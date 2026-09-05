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

# ── The unit is the workspace package, not the repository ────────────────────
# Every gate measures from the NEAREST package.json. A single-package project
# has exactly one — the cwd — and nothing below changes for it. A workspace
# root has one per member, and the per-member gates run once per member
# instead of once for a root that owns neither the specs nor the docs.
#
# Root-only by nature, and deliberately left alone: tsc, oxlint and oxfmt
# measure from their CONFIG file, not from a package, and each already walks
# the whole tree from the cwd; knip is natively workspace-aware, so a member's
# knip config belongs under the root config's `workspaces` key, not in a second
# invocation.
WORKSPACE_MEMBERS=()
while IFS= read -r workspace_member; do
    [ -n "$workspace_member" ] && WORKSPACE_MEMBERS+=("$workspace_member")
done < <(node "$PACKAGE_ROOT/lib/workspace-members.js" 2>/dev/null)

# The nearest package.json OWNS a directory. Walk up from the given path and
# stop at the cwd — a gate never asks a question above the project it runs in.
nearest_package_dir() {
    local dir="$1"
    while true; do
        if [ -f "$dir/package.json" ]; then
            printf '%s\n' "$dir"
            return 0
        fi
        [ "$dir" = "." ] && return 1
        dir=$(dirname "$dir")
    done
}

# The @jterrazz/test conventions checker (D4 tokens, C8/C9 fixtures) runs only when the
# owning package depends on @jterrazz/test — auto-detected from its package.json.
project_uses_jterrazz_test() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));const d={...p.dependencies,...p.devDependencies,...p.peerDependencies};process.exit(d["@jterrazz/test"]?0:1)' "$dir/package.json" 2>/dev/null
}

# In a workspace the dependency may sit on a member alone — the warning below
# is about the ROOT oxlint config, but the reason to print it is anywhere.
workspace_uses_jterrazz_test() {
    project_uses_jterrazz_test "." && return 0
    local member
    for member in "${WORKSPACE_MEMBERS[@]}"; do
        project_uses_jterrazz_test "$member" && return 0
    done
    return 1
}

# A path git has been told to forget is not this workspace's source. Clones,
# workbenches and build output live under gitignored paths, and the conventions
# checker walks whatever root it is handed — so the filter belongs here, before
# the handing over. Outside a git tree the question has no answer, and the
# non-zero exit reads as "not ignored", which is the right default.
path_is_gitignored() {
    git check-ignore --quiet "$1" 2>/dev/null
}

# A discovered root must belong to the member that produced it. Walk back up
# from the candidate: a nested `.git`, or a package.json no workspace glob
# claims, means the walk crossed OUT of this workspace into a foreign tree —
# a vendored dependency, a sibling clone — whose conventions are not ours.
inside_owning_member() {
    local dir member="$2"
    dir=$(dirname "$1")
    while [ "$dir" != "$member" ] && [ "$dir" != "." ] && [ "$dir" != "/" ]; do
        if [ -e "$dir/.git" ] || [ -f "$dir/package.json" ]; then
            return 1
        fi
        dir=$(dirname "$dir")
    done
    return 0
}

# Every specs root the workspace owns: the root's own, plus the first one found
# At or below each member (a member that nests its facet — web/specs — counts).
# Never descends INTO a specs tree: the fixtures under it are not specs roots.
discover_specs_roots() {
    {
        [ -d "specs" ] && ! path_is_gitignored "specs" && printf '%s\n' "specs"
        local member candidate
        for member in "${WORKSPACE_MEMBERS[@]}"; do
            while IFS= read -r candidate; do
                [ -n "$candidate" ] || continue
                path_is_gitignored "$candidate" && continue
                inside_owning_member "$candidate" "$member" || continue
                printf '%s\n' "$candidate"
            done < <(find "$member" \
                \( -name node_modules -o -name dist -o -name .git \) -prune -o \
                -type d -name specs -prune -print 2>/dev/null)
        done
    } | LC_ALL=C sort -u
}

# Every package that owns a committed docs projection. A package's docs sit at
# its own root — that IS the nearest-package.json rule, so no walk is needed.
discover_docs_roots() {
    {
        [ -d "docs/reference" ] && printf '%s\n' "."
        local member
        for member in "${WORKSPACE_MEMBERS[@]}"; do
            [ -d "$member/docs/reference" ] && printf '%s\n' "$member"
        done
    } | LC_ALL=C sort -u
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

    if workspace_uses_jterrazz_test; then
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
    # Merge base config (from this package) with optional project-local knip.json.
    # Root-only on purpose: knip reads the workspace globs itself and reports per
    # member from one run — a second invocation per member would double-report.
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

    # Conventions checker: only in check mode, once per specs root the workspace
    # owns, gated by the package that OWNS that root — a member may depend on
    # @jterrazz/test while the root does not, and the reverse.
    local checker_pids=()
    local checker_logs=()
    local checker_status=0
    if [ "$FIX_MODE" = false ]; then
        local checker_index=0
        while IFS= read -r specs_root; do
            [ -n "$specs_root" ] || continue
            local owner
            owner=$(nearest_package_dir "$(dirname "$specs_root")") || continue
            project_uses_jterrazz_test "$owner" || continue
            "$CHECKER" "$specs_root" > "$tmp_dir/checker-$checker_index.log" 2>&1 &
            checker_pids+=($!)
            checker_logs+=("$tmp_dir/checker-$checker_index.log")
            checker_index=$((checker_index + 1))
        done < <(discover_specs_roots)
    fi

    # Docs (sync): only in check mode, and only for a package that has generated
    # its committed docs (docs/reference/ exists — opt-in by first generation).
    # Delegates to docs.sh --check: regenerate into a temp dir, diff the
    # committed projections. Never duplicates the compiler's logic.
    local docs_pids=()
    local docs_logs=()
    local docs_status=0
    if [ "$FIX_MODE" = false ]; then
        local docs_index=0
        while IFS= read -r docs_root; do
            [ -n "$docs_root" ] || continue
            bash "$SCRIPT_DIR/docs.sh" "$(cd "$docs_root" && pwd)" "$PACKAGE_ROOT" --check \
                > "$tmp_dir/docs-$docs_index.log" 2>&1 &
            docs_pids+=($!)
            docs_logs+=("$tmp_dir/docs-$docs_index.log")
            docs_index=$((docs_index + 1))
        done < <(discover_docs_roots)
    fi

    # Wait and collect statuses
    wait $type_pid;   local type_status=$?
    wait $lint_pid;   local lint_status=$?
    wait $format_pid; local format_status=$?
    [ -n "$knip_pid" ] && { wait $knip_pid; knip_status=$?; }

    # One pass, N runs: the pass fails if any run failed, and only the logs of
    # the runs that FAILED are printed — a green member stays silent.
    local checker_failed_logs=()
    local index=0
    for pid in "${checker_pids[@]}"; do
        if ! wait "$pid"; then
            checker_status=1
            checker_failed_logs+=("${checker_logs[$index]}")
        fi
        index=$((index + 1))
    done

    local docs_failed_logs=()
    index=0
    for pid in "${docs_pids[@]}"; do
        if ! wait "$pid"; then
            docs_status=1
            docs_failed_logs+=("${docs_logs[$index]}")
        fi
        index=$((index + 1))
    done

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

        if [ ${#checker_pids[@]} -gt 0 ]; then
            printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Test Conventions (@jterrazz/test)\n\n"
            if [ $checker_status -ne 0 ]; then
                for log in "${checker_failed_logs[@]}"; do
                    [ -s "$log" ] && cat "$log"
                done
                printf "${RED}✗ Failed with exit code %d${NC}\n" $checker_status
            else
                printf "${GREEN}✓ Passed${NC}\n"
            fi
        fi

        if [ ${#docs_pids[@]} -gt 0 ]; then
            printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} Docs (sync)\n\n"
            if [ $docs_status -ne 0 ]; then
                for log in "${docs_failed_logs[@]}"; do
                    [ -s "$log" ] && cat "$log"
                done
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
