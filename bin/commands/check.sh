#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN_BG='\033[46m'
BRIGHT_WHITE='\033[1;30m'
NC='\033[0m'

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
PACKAGE_ROOT="$SCRIPT_DIR/../.."

# npm may hoist a tool to the consumer's node_modules/.bin or nest it under this package.
find_binary() {
    local name="$1"
    if [ -x "$PACKAGE_ROOT/node_modules/.bin/$name" ]; then
        echo "$PACKAGE_ROOT/node_modules/.bin/$name"
    elif [ -x "$PACKAGE_ROOT/../../.bin/$name" ]; then
        echo "$PACKAGE_ROOT/../../.bin/$name"
    else
        echo "$name"
    fi
}

# TypeScript 7 comes from the per-platform @typescript/typescript-* packages: a typescript@7 under the
# "typescript" name would hijack the JS API perfectionist and dependency-cruiser load, under pnpm's hoist fallback.
# shellcheck source=../find-tsc.sh
. "$SCRIPT_DIR/../find-tsc.sh"

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

add_tsgolint_to_path

# shellcheck source=../tool-configs.sh
. "$SCRIPT_DIR/../tool-configs.sh"

TSC=$(find_tsc)
OXLINT=$(find_binary oxlint)
OXFMT=$(find_binary oxfmt)
KNIP=$(find_binary knip)
DEPCRUISE=$(find_binary depcruise)
PUBLINT=$(find_binary publint)
ATTW=$(find_binary attw)
PRETTIER=$(find_binary prettier)

# `astro` is the consumer's dependency: the lookup starts at the project.
find_project_binary() {
    local name="$1"
    if [ -x "node_modules/.bin/$name" ]; then
        echo "$PWD/node_modules/.bin/$name"
    else
        find_binary "$name"
    fi
}

# The plugin goes by resolved path: prettier resolves a plugin name from the consumer's cwd, which no longer declares it.
PRETTIER_ASTRO_CONFIG="$PACKAGE_ROOT/src/presets/prettier/astro.json"
PRETTIER_ASTRO_PLUGIN=$(cd "$PACKAGE_ROOT" && node -e 'process.stdout.write(require.resolve("prettier-plugin-astro"))' 2>/dev/null)
# The consumer's binary: the version a project installed is the rulebook it agreed to.
CHECKER=$(find_project_binary jterrazz-test-check)

CHECKER_FLOOR=$(node "$PACKAGE_ROOT/lint/reading/test-package.js" --floor)

# The unit is the workspace package. tsc, oxlint and oxfmt measure from their config and walk the tree
# themselves; knip is workspace-aware, so a member's knip config sits under the root's `workspaces` key.
WORKSPACE_MEMBERS=()
while IFS= read -r workspace_member; do
    [ -n "$workspace_member" ] && WORKSPACE_MEMBERS+=("$workspace_member")
done < <(node "$PACKAGE_ROOT/lint/reading/workspace-members.js" 2>/dev/null)

# Stops at the cwd: a gate never asks a question above the project it runs in.
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

# npm hoisting makes a member a consumer of an @jterrazz/test it never declares.
project_uses_jterrazz_test() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));const d={...p.dependencies,...p.devDependencies,...p.peerDependencies};process.exit(d["@jterrazz/test"]?0:1)' "$dir/package.json" 2>/dev/null && return 0
    node "$PACKAGE_ROOT/lint/reading/test-package.js" "$dir" > /dev/null 2>&1
}

# An older release still counts, so the pass can say once that it is dormant.
member_resolves_checker() {
    node "$PACKAGE_ROOT/lint/reading/test-package.js" "${1:-.}" > /dev/null 2>&1
}

# A member whose @jterrazz/test is nested rather than hoisted owns a different release from the root's.
member_checker() {
    local dir="${1:-.}" bin
    node "$PACKAGE_ROOT/lint/reading/test-package.js" "$dir" --at-least "$CHECKER_FLOOR" \
        > /dev/null 2>&1 || return 1
    bin=$(node "$PACKAGE_ROOT/lint/reading/test-package.js" "$dir" --bin 2>/dev/null) || return 1
    [ -n "$bin" ] || return 1
    CHECKER_COMMAND=(node "$bin")
}

# The tree pass needs no floor, and falls back to the toolchain's lookup.
tree_checker() {
    local bin
    bin=$(node "$PACKAGE_ROOT/lint/reading/test-package.js" "${1:-.}" --bin 2>/dev/null)
    if [ -n "$bin" ]; then
        CHECKER_COMMAND=(node "$bin")
    else
        CHECKER_COMMAND=("$CHECKER")
    fi
}

# `astro check` is the only checker that reads a template's frontmatter.
project_uses_astro() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));const d={...p.dependencies,...p.devDependencies,...p.peerDependencies};process.exit(d["astro"]?0:1)' "$dir/package.json" 2>/dev/null
}

project_is_publishable() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));process.exit(p.private!==true&&(p.exports||p.main||p.publishConfig)?0:1)' "$dir/package.json" 2>/dev/null
}

# The conventions checker walks whatever root it is handed; outside a git tree nothing is ignored.
path_is_gitignored() {
    git check-ignore --quiet "$1" 2>/dev/null
}

# A nested `.git`, or a package.json no workspace glob claims, means the walk crossed into a foreign tree.
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

# Never descends into a specs tree: the fixtures under it are not specs roots.
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

# oxlint drops a config it cannot load and still exits 0; a CommonJS config cannot load an ESM preset or plugin.
commonjs_oxlint_config() {
    case "$OXLINT_CONFIG" in
        *.cjs) printf '%s' "$OXLINT_CONFIG" ;;
        *.js)
            if ! node -e 'process.exit(require("./package.json").type==="module"?0:1)' 2>/dev/null; then
                printf '%s' "$OXLINT_CONFIG"
            fi
            ;;
    esac
}

COMMAND=""
LINT_ARGS=()

if [[ "${1:-}" == -* ]] || [ -z "${1:-}" ]; then
    true
else
    COMMAND="$1"
    shift
fi

# `--json` is the drift report's: the fleet reads that block as one JSON object.
DRIFT_ARGS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --ignore-pattern)
            LINT_ARGS+=("$1" "$2")
            shift 2
            ;;
        --json)
            DRIFT_ARGS+=("$1")
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Every pass; the spec harness replaces this definition by its text.
selected() {
    return 0
}

# A sweep that could not answer hands oxlint the directory: a gate never goes silent on a read it did not make.
LINT_TARGETS=()
LINT_NOTHING=false
read_lint_targets() {
    local listed target
    listed=$(node "$PACKAGE_ROOT/src/cli/lint-targets.js" . "${OXLINT_TARGET_ARGS[@]}" "${LINT_ARGS[@]}" 2>/dev/null) || return 0
    while IFS= read -r target; do
        [ -n "$target" ] && LINT_TARGETS+=("$target")
    done <<< "$listed"
    [ ${#LINT_TARGETS[@]} -eq 0 ] && LINT_NOTHING=true
    return 0
}

run_oxlint() {
    if [ "$LINT_NOTHING" = true ]; then
        case " $* " in *" --format json "*) printf '{ "diagnostics": [] }\n' ;; esac
        return 0
    fi
    local config=("${OXLINT_CONFIG_ARGS[@]}")
    case " $* " in *" -c "*) config=() ;; esac
    "$OXLINT" "${config[@]}" "$@" "${LINT_TARGETS[@]}"
}

FORMAT_TARGETS=()
FORMAT_NOTHING=false
read_format_targets() {
    local listed target
    listed=$(node "$PACKAGE_ROOT/src/cli/lint-targets.js" . --all "${OXFMT_TARGET_ARGS[@]}" "${LINT_ARGS[@]}" 2>/dev/null) || return 0
    while IFS= read -r target; do
        [ -n "$target" ] && FORMAT_TARGETS+=("$target")
    done <<< "$listed"
    [ ${#FORMAT_TARGETS[@]} -eq 0 ] && FORMAT_NOTHING=true
    return 0
}

# A list holding only shapes oxfmt does not parse is nothing to format, not an error.
run_oxfmt() {
    [ "$FORMAT_NOTHING" = true ] && return 0
    if [ ${#FORMAT_TARGETS[@]} -eq 0 ]; then
        "$OXFMT" "${OXFMT_CONFIG_ARGS[@]}" "$@"
    else
        "$OXFMT" "${OXFMT_CONFIG_ARGS[@]}" "$@" --no-error-on-unmatched-pattern "${FORMAT_TARGETS[@]}"
    fi
}

# A pass that did not apply prints nothing. A green pass prints its log only when it wrote something, so a
# green run is byte-identical everywhere: oxlint's own summary differs by environment.
report_pass() {
    local label="$1" status="$2" log="$3" writer="${4:-}"

    printf "\n${CYAN_BG}${BRIGHT_WHITE} RUN ${NC} %s\n\n" "$label"
    if [ "$status" -ne 0 ] || [ -n "$writer" ]; then
        [ -s "$log" ] && cat "$log"
    fi
    if [ "$status" -eq 0 ]; then
        printf "${GREEN}✓ Passed${NC}\n"
    else
        printf "${RED}✗ Failed with exit code %d${NC}\n" "$status"
    fi
}

# A config oxlint cannot parse lints nothing; a CommonJS one is dropped whole with exit 0. Both fail the pass.
judge_lint_config() {
    local cjs
    cjs=$(commonjs_oxlint_config)
    local refusals=""

    if grep -q 'Failed to parse oxlint configuration file' "$tmp_dir/lint.log" "$tmp_dir/lint.json" 2>/dev/null; then
        refusals+="oxlint-config-unparsed  ${OXLINT_CONFIG}  oxlint refused this config and linted nothing — its own report is above"$'\n'
    fi
    if [ -n "$cjs" ]; then
        refusals+="oxlint-config-commonjs  ${cjs}  a CommonJS config cannot load an ESM preset or plugin, and oxlint drops what it cannot load — write oxlint.config.ts or .mjs"$'\n'
    fi

    [ -z "$refusals" ] && return 0

    printf '%s' "$refusals" >> "$tmp_dir/lint.log"
    lint_status=1
}

join_logs() {
    local into="$1"
    shift
    : > "$into"
    local log
    for log in "$@"; do
        [ -s "$log" ] && cat "$log" >> "$into"
    done
}

tmp_dir=$(mktemp -d)
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

RENAMED_IDS=(--renamed "$PACKAGE_ROOT/lint/migration/renamed-ids.json")

rewrite_renamed_ids_before_any_pass() {
    node "$PACKAGE_ROOT/lint/migration/rename.js" . "${LINT_ARGS[@]}" --fix > "$tmp_dir/renamed.log" 2>&1
}

run_checks() {
    local FIX_MODE="$1"
    local LABEL

    if [ "$FIX_MODE" = true ]; then
        LABEL="Running quality fixes"
    else
        LABEL="Running quality checks"
    fi

    printf "${CYAN_BG}${BRIGHT_WHITE} START ${NC} ${LABEL}\n"

    if [ "$FIX_MODE" = true ]; then
        rewrite_renamed_ids_before_any_pass
    fi

    # Chosen before oxlint starts: whether the report is written depends on this list.
    local checker_members=()
    local checker_member_bins=()
    local checker_dormant=0
    if [ "$FIX_MODE" = false ] && selected conventions; then
        local member
        for member in "." "${WORKSPACE_MEMBERS[@]}"; do
            member_resolves_checker "$member" || continue
            if ! member_checker "$member"; then
                checker_dormant=$((checker_dormant + 1))
                printf 'the member pass needs @jterrazz/test %s; %s resolves %s\n' \
                    "$CHECKER_FLOOR" \
                    "$([ "$member" = "." ] && printf 'this project' || printf '%s' "$member")" \
                    "$(node "$PACKAGE_ROOT/lint/reading/test-package.js" "$member" 2>/dev/null \
                        || printf 'none this walk reaches')" \
                    >> "$tmp_dir/checker-dormant.log"
                continue
            fi
            checker_members+=("$member")
            checker_member_bins+=("${CHECKER_COMMAND[1]}")
        done
    fi

    local runs_oxlint=false
    if selected oxlint || [ ${#checker_members[@]} -gt 0 ]; then
        runs_oxlint=true
    fi
    local runs_names=false
    if selected names || { selected oxlint && [ "$FIX_MODE" = false ]; }; then
        runs_names=true
    fi
    local runs_comments=false
    if selected comments || { selected oxlint && [ "$FIX_MODE" = false ]; }; then
        runs_comments=true
    fi

    [ "$runs_oxlint" = true ] && read_lint_targets
    selected oxfmt && read_format_targets

    local type_pid=""
    if selected typescript; then
        "$TSC" --noEmit > "$tmp_dir/type.log" 2>&1 &
        type_pid=$!
    fi

    # `--type-aware` is unconditional: a rule set only sometimes passed is only sometimes enforced.
    # In fix mode the two rewriters run in sequence: in parallel oxfmt lands its copy over oxlint's.
    local lint_pid=""
    local lint_status=0
    local lint_held=false
    local format_status=0
    if [ "$FIX_MODE" = true ]; then
        # Unsafe fixers are turned off for this run by a wrapper beside each config scope's config
        # (src/cli/unsafe-fixers.js); every run ignores the wrapper's name, and the pass deletes it.
        if [ "$runs_oxlint" = true ] && [ "$LINT_NOTHING" = false ]; then
            local fix_wrapper="oxlint.fix.config.mjs"
            local base_config="$DEFAULT_OXLINT_CONFIG"
            local scope_mode="flat"
            if [ -n "$OXLINT_CONFIG" ]; then
                base_config="$PWD/$OXLINT_CONFIG"
                scope_mode="nested"
            fi
            local fix_scopes wrapper listing target
            fix_scopes=$(printf '%s\n' "${LINT_TARGETS[@]}" |
                node "$PACKAGE_ROOT/src/cli/unsafe-fixers.js" "$base_config" "$scope_mode" "$tmp_dir")
            while IFS=$'\t' read -r wrapper listing; do
                [ -n "$wrapper" ] || continue
                local scope_targets=()
                while IFS= read -r target; do
                    [ -n "$target" ] && scope_targets+=("$target")
                done < "$listing"
                "$OXLINT" --type-aware --fix -c "$wrapper" --ignore-pattern "$fix_wrapper" \
                    "${LINT_ARGS[@]}" "${scope_targets[@]}" >> "$tmp_dir/lint.log" 2>&1 ||
                    lint_status=$?
                rm -f "$wrapper"
            done <<< "$fix_scopes"
        fi
        if selected oxfmt; then
            run_oxfmt > "$tmp_dir/format.log" 2>&1 || format_status=$?
        fi
    else
        # `--deny-warnings`: a warn leaves the exit code at 0 and would hide a whole tier from `check`.
        # One JSON run, read by the ratchet, the checker's member runs and the drawn report.
        if [ "$runs_oxlint" = true ]; then
            run_oxlint --type-aware --deny-warnings --format json "${LINT_ARGS[@]}" \
                > "$tmp_dir/lint.json" 2> "$tmp_dir/lint.err" &
            lint_pid=$!
        fi
        : > "$tmp_dir/lint.log"
    fi
    local lint_waited=false

    local format_pid=""
    if [ "$FIX_MODE" = false ] && selected oxfmt; then
        run_oxfmt --check > "$tmp_dir/format.log" 2>&1 &
        format_pid=$!
    fi

    # Check mode only: knip's fix is destructive. Uncached: `--cache` misses a file added to a directory
    # that held no match, and a gate that passes on stale knowledge is worse than a slow one.
    local knip_pid=""
    local knip_status=0
    if [ "$FIX_MODE" = false ] && selected knip; then
        local knip_base="$PACKAGE_ROOT/src/presets/knip/config.json"
        local knip_project=""
        [ -f "knip.json" ] && knip_project="knip.json"
        [ -f "knip.jsonc" ] && knip_project="knip.jsonc"

        node "$PACKAGE_ROOT/src/cli/merge-knip-config.js" "$knip_base" $knip_project > "$tmp_dir/knip-merged.json"
        "$KNIP" --no-progress --no-config-hints --config "$tmp_dir/knip-merged.json" > "$tmp_dir/knip.log" 2>&1 &
        knip_pid=$!
    fi

    # The ancestor probe lives here because it decides whether the pass prints at all; fix mode never
    # rewrites another project's `.gitignore`.
    local gitignore_pid=""
    local gitignore_status=0
    local gitignore_applicable=false
    if ! selected gitignore; then
        gitignore_applicable=false
    elif [ -f ".gitignore" ]; then
        gitignore_applicable=true
    elif [ "$FIX_MODE" = false ] && node "$PACKAGE_ROOT/lint/checks/gitignore.js" --has-ancestor > /dev/null 2>&1; then
        gitignore_applicable=true
    fi
    if [ "$gitignore_applicable" = true ]; then
        if [ "$FIX_MODE" = true ]; then
            node "$PACKAGE_ROOT/lint/checks/gitignore.js" --fix > "$tmp_dir/gitignore.log" 2>&1 &
        else
            node "$PACKAGE_ROOT/lint/checks/gitignore.js" > "$tmp_dir/gitignore.log" 2>&1 &
        fi
        gitignore_pid=$!
    fi

    # The unit is the repository: a `.git` here, a file in a worktree and a directory in a clone.
    local docs_layout_pid=""
    local docs_layout_status=0
    if [ "$FIX_MODE" = false ] && selected docs && [ -e ".git" ]; then
        node "$PACKAGE_ROOT/lint/checks/docs.cli.js" > "$tmp_dir/docs-layout.log" 2>&1 &
        docs_layout_pid=$!
    fi

    local suppressions_pid=""
    local suppressions_status=0
    local suppressions_fix=()
    [ "$FIX_MODE" = true ] && suppressions_fix=(--fix)
    if selected suppressions; then
        node "$PACKAGE_ROOT/lint/checks/suppressions.js" . --oxlint "$OXLINT" \
            "${OXLINT_CONFIG_ARGS[@]}" "${suppressions_fix[@]}" "${LINT_ARGS[@]}" > "$tmp_dir/suppressions.log" 2>&1 &
        suppressions_pid=$!
    fi

    local markdown_pid=""
    local markdown_status=0
    if [ "$FIX_MODE" = false ] && selected markdown; then
        node "$PACKAGE_ROOT/lint/checks/markdown.js" . "${LINT_ARGS[@]}" \
            > "$tmp_dir/markdown.log" 2>&1 &
        markdown_pid=$!
    fi

    # Node warns while reparsing `jterrazz.config.ts` as ESM without `"type": "module"`: noise about loading.
    local names_pid=""
    local names_status=0
    local names_mode=(--report "$tmp_dir/names.json")
    [ "$FIX_MODE" = true ] && names_mode=(--fix)
    if [ "$runs_names" = true ]; then
        node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$PACKAGE_ROOT/lint/checks/names.js" . "${LINT_ARGS[@]}" \
            "${names_mode[@]}" "${RENAMED_IDS[@]}" > "$tmp_dir/names.log" 2>&1 &
        names_pid=$!
    fi

    local comments_pid=""
    local comments_status=0
    if [ "$runs_comments" = true ] && [ "$FIX_MODE" = false ]; then
        node "$PACKAGE_ROOT/lint/checks/comments.js" . "${LINT_ARGS[@]}" "${RENAMED_IDS[@]}" \
            --report "$tmp_dir/comments.json" > "$tmp_dir/comments.log" 2>&1 &
        comments_pid=$!
    fi

    local secrets_pid=""
    local secrets_status=0
    if [ "$FIX_MODE" = false ] && selected secrets; then
        node "$PACKAGE_ROOT/lint/checks/secrets.js" . "${LINT_ARGS[@]}" \
            > "$tmp_dir/secrets.log" 2>&1 &
        secrets_pid=$!
    fi

    local astro_pid=""
    local astro_status=0
    if selected astro && project_uses_astro "."; then
        ASTRO=$(find_project_binary astro)
        # A subshell so both halves run and report; `local` has no meaning past the `&`.
        (
            "$ASTRO" check
            astro_check=$?
            if [ "$FIX_MODE" = true ]; then
                "$PRETTIER" --write --config "$PRETTIER_ASTRO_CONFIG" \
                    --plugin "$PRETTIER_ASTRO_PLUGIN" \
                    --no-error-on-unmatched-pattern "**/*.astro"
            else
                "$PRETTIER" --check --config "$PRETTIER_ASTRO_CONFIG" \
                    --plugin "$PRETTIER_ASTRO_PLUGIN" \
                    --no-error-on-unmatched-pattern "**/*.astro"
            fi
            astro_format=$?
            [ $astro_check -eq 0 ] && [ $astro_format -eq 0 ]
        ) > "$tmp_dir/astro.log" 2>&1 &
        astro_pid=$!
    fi

    # A project with no declared layer map is in breach of none.
    local architecture_pid=""
    local architecture_status=0
    if [ "$FIX_MODE" = false ] && selected architecture &&
        { [ -f ".dependency-cruiser.cjs" ] || [ -f ".dependency-cruiser.js" ] ||
            [ -f ".dependency-cruiser.mjs" ]; }; then
        node "$PACKAGE_ROOT/lint/checks/architecture.js" . --depcruise "$DEPCRUISE" \
            > "$tmp_dir/architecture.log" 2>&1 &
        architecture_pid=$!
    fi

    local publish_pids=()
    local publish_logs=()
    local publish_status=0
    if [ "$FIX_MODE" = false ] && selected publish; then
        local publish_index=0
        for publish_root in "." "${WORKSPACE_MEMBERS[@]}"; do
            project_is_publishable "$publish_root" || continue
            node "$PACKAGE_ROOT/lint/checks/publish.js" "$publish_root" \
                --publint "$PUBLINT" --attw "$ATTW" \
                > "$tmp_dir/publish-$publish_index.log" 2>&1 &
            publish_pids+=($!)
            publish_logs+=("$tmp_dir/publish-$publish_index.log")
            publish_index=$((publish_index + 1))
        done
    fi

    # One run per specs root, gated by its owning package, and one `--member` run per member resolving
    # @jterrazz/test, handed the oxlint report once it is written.
    local checker_pids=()
    local checker_logs=()
    local checker_status=0
    local checker_root_log=""
    if [ "$FIX_MODE" = false ] && selected conventions; then
        local checker_index=0
        while IFS= read -r specs_root; do
            [ -n "$specs_root" ] || continue
            local owner
            owner=$(nearest_package_dir "$(dirname "$specs_root")") || continue
            project_uses_jterrazz_test "$owner" || continue
            tree_checker "$owner"
            "${CHECKER_COMMAND[@]}" "$specs_root" > "$tmp_dir/checker-$checker_index.log" 2>&1 &
            checker_pids+=($!)
            checker_logs+=("$tmp_dir/checker-$checker_index.log")
            checker_index=$((checker_index + 1))
        done < <(discover_specs_roots)

        if [ ${#checker_members[@]} -gt 0 ]; then
            wait $lint_pid
            lint_status=$?
            lint_waited=true
        fi
        # The root's run is the one @jterrazz/test's ratchet judges.
        local member_index=0
        for member in "${checker_members[@]}"; do
            local member_bin="${checker_member_bins[$member_index]}"
            member_index=$((member_index + 1))
            if [ "$member" = "." ]; then
                checker_root_log="$tmp_dir/checker-$checker_index.log"
            fi
            node "$member_bin" --member "$member" --oxlint-report "$tmp_dir/lint.json" \
                > "$tmp_dir/checker-$checker_index.log" 2>&1 &
            checker_pids+=($!)
            checker_logs+=("$tmp_dir/checker-$checker_index.log")
            checker_index=$((checker_index + 1))
        done
    fi

    local type_status=0
    [ -n "$type_pid" ] && { wait $type_pid; type_status=$?; }
    [ -n "$lint_pid" ] && [ "$lint_waited" = false ] && { wait $lint_pid; lint_status=$?; }

    # The ratchet is the verdict in both modes, or `fix` then `check` reads red then green on one tree; it is
    # told the linter's exit code, so a failure no diagnostic carries is never forgiven. Fix mode judges what
    # survived, with the unsafe fixers armed again so a directive naming one is used.
    if [ "$FIX_MODE" = true ] && [ "$runs_oxlint" = true ]; then
        run_oxlint --type-aware --format json "${LINT_ARGS[@]}" \
            > "$tmp_dir/lint.json" 2>/dev/null
    fi

    # Two writers of one file in fix mode: the Names pass finishes before the ratchet reads it.
    [ -n "$names_pid" ] && { wait $names_pid; names_status=$?; }
    [ -n "$comments_pid" ] && { wait $comments_pid; comments_status=$?; }
    if [ "$FIX_MODE" = true ] && selected comments; then
        node "$PACKAGE_ROOT/lint/checks/comments.js" . "${LINT_ARGS[@]}" --fix \
            > "$tmp_dir/comments.log" 2>&1
        comments_status=$?
    fi
    if selected oxlint; then
        local linter_exit=()
        local names_report=()
        local ratchet_fix=()
        if [ "$FIX_MODE" = true ]; then
            ratchet_fix=(--fix)
        else
            linter_exit=(--linter-exit "$lint_status")
            names_report=(--names "$tmp_dir/names.json" --comments "$tmp_dir/comments.json")
        fi
        node "$PACKAGE_ROOT/lint/ratchet/baseline.js" "$tmp_dir/lint.json" . \
            "${linter_exit[@]}" "${names_report[@]}" "${ratchet_fix[@]}" "${RENAMED_IDS[@]}" > "$tmp_dir/ratchet.log" 2>&1
        lint_status=$?
        if [ "$FIX_MODE" = true ]; then
            cat "$tmp_dir/renamed.log" "$tmp_dir/ratchet.log" > "$tmp_dir/ratchet-renamed.log"
            mv "$tmp_dir/ratchet-renamed.log" "$tmp_dir/ratchet.log"
        else
            node "$PACKAGE_ROOT/lint/migration/rename.js" . "${LINT_ARGS[@]}" \
                >> "$tmp_dir/ratchet.log" 2>&1 || lint_status=1
        fi
        if [ "$lint_status" -eq 0 ] && [ ${#names_report[@]} -gt 0 ]; then
            lint_held=true
        else
            cat "$tmp_dir/ratchet.log" >> "$tmp_dir/lint.log"
        fi
    fi

    [ -n "$format_pid" ] && { wait $format_pid; format_status=$?; }
    [ -n "$knip_pid" ] && { wait $knip_pid; knip_status=$?; }
    [ -n "$gitignore_pid" ] && { wait $gitignore_pid; gitignore_status=$?; }
    [ -n "$docs_layout_pid" ] && { wait $docs_layout_pid; docs_layout_status=$?; }
    [ -n "$suppressions_pid" ] && { wait $suppressions_pid; suppressions_status=$?; }
    [ -n "$markdown_pid" ] && { wait $markdown_pid; markdown_status=$?; }
    [ -n "$architecture_pid" ] && { wait $architecture_pid; architecture_status=$?; }
    [ -n "$astro_pid" ] && { wait $astro_pid; astro_status=$?; }
    [ -n "$secrets_pid" ] && { wait $secrets_pid; secrets_status=$?; }

    local checker_failed_logs=()
    local index=0
    for pid in "${checker_pids[@]}"; do
        if ! wait "$pid"; then
            checker_status=1
            checker_failed_logs+=("${checker_logs[$index]}")
        fi
        index=$((index + 1))
    done

    # A green run prints only the build guard's line when it had nothing to judge.
    for pid in "${publish_pids[@]}"; do
        wait "$pid" || publish_status=1
    done

    join_logs "$tmp_dir/checker.log" "${checker_failed_logs[@]}"
    join_logs "$tmp_dir/publish.log" "${publish_logs[@]}"

    # The checker's exit code is the verdict. A green pass still names a dormant member, or a reader
    # would believe every member was asked.
    local checker_write=""
    if [ "$checker_dormant" -gt 0 ]; then
        cat "$tmp_dir/checker-dormant.log" "$tmp_dir/checker.log" \
            > "$tmp_dir/checker-reported.log"
        mv "$tmp_dir/checker-reported.log" "$tmp_dir/checker.log"
        checker_write="writer"
    fi
    # Only the two exact shapes, so a release printing another form adds nothing here.
    if [ "$checker_status" -eq 0 ] && [ -n "$checker_root_log" ] &&
        grep -E '^jterrazz\.baseline\.json › test: ([0-9]+ held across [0-9]+ rules?|nothing held)$' "$checker_root_log" \
            >> "$tmp_dir/checker.log"; then
        checker_write="writer"
    fi

    local lint_label="Oxlint Check"
    local format_label="Oxfmt Check"
    local write=""
    if [ "$FIX_MODE" = true ]; then
        lint_label="Oxlint Fix"
        format_label="Oxfmt Format"
        write="writer"
    fi

    local lint_log="$tmp_dir/lint.log"
    local lint_speaks=""
    if selected oxlint; then
        judge_lint_config
        if [ "$FIX_MODE" = false ] && [ "$lint_status" -ne 0 ]; then
            {
                node "$PACKAGE_ROOT/src/cli/oxlint-report.js" "$tmp_dir/lint.json" "$tmp_dir/lint.err" \
                    --oxlint "$OXLINT"
                cat "$tmp_dir/lint.log"
            } > "$tmp_dir/lint-shown.log"
            mv "$tmp_dir/lint-shown.log" "$tmp_dir/lint.log"
        fi
        if [ "$lint_status" -eq 0 ] && [ "$lint_held" = true ]; then
            lint_log="$tmp_dir/ratchet.log"
            lint_speaks="writer"
        fi
        if [ "$FIX_MODE" = true ] && [ "$lint_status" -eq 0 ] && [ -s "$tmp_dir/ratchet.log" ]; then
            lint_log="$tmp_dir/ratchet.log"
            lint_speaks="writer"
        fi
        # @jterrazz/test's checker leaves printing its `jterrazz(*)` diagnostics to this pass, even when it is green.
        if [ "$FIX_MODE" = false ] && [ "$lint_status" -eq 0 ] && [ "$checker_status" -ne 0 ]; then
            node "$PACKAGE_ROOT/src/cli/oxlint-report.js" "$tmp_dir/lint.json" "$tmp_dir/lint.err" \
                --oxlint "$OXLINT" --if-diagnostics > "$tmp_dir/lint-drawn.log"
            if [ -s "$tmp_dir/lint-drawn.log" ]; then
                [ -n "$lint_speaks" ] && cat "$lint_log" >> "$tmp_dir/lint-drawn.log"
                lint_log="$tmp_dir/lint-drawn.log"
                lint_speaks="writer"
            fi
        fi
    else
        lint_status=0
    fi
    selected names || names_status=0
    selected comments || comments_status=0

    [ -n "$type_pid" ] && report_pass "TypeScript Check" $type_status "$tmp_dir/type.log"
    selected oxlint && report_pass "$lint_label" $lint_status "$lint_log" "$lint_speaks"
    selected oxfmt && report_pass "$format_label" $format_status "$tmp_dir/format.log"
    [ -n "$gitignore_pid" ] &&
        report_pass "Gitignore (artefacts)" $gitignore_status "$tmp_dir/gitignore.log" writer
    [ -n "$knip_pid" ] &&
        report_pass "Knip (unused code)" $knip_status "$tmp_dir/knip.log"
    { [ ${#checker_pids[@]} -gt 0 ] || [ "$checker_dormant" -gt 0 ]; } &&
        report_pass "Test Conventions (@jterrazz/test)" $checker_status "$tmp_dir/checker.log" \
            "$checker_write"
    [ -n "$docs_layout_pid" ] &&
        report_pass "Docs (layout)" $docs_layout_status "$tmp_dir/docs-layout.log"
    [ ${#publish_pids[@]} -gt 0 ] &&
        report_pass "Publish (packaging)" $publish_status "$tmp_dir/publish.log" writer
    [ -n "$architecture_pid" ] &&
        report_pass "Architecture (layer map)" $architecture_status "$tmp_dir/architecture.log"
    [ -n "$astro_pid" ] &&
        report_pass "Astro (check + format)" $astro_status "$tmp_dir/astro.log" "$write"
    [ -n "$suppressions_pid" ] &&
        report_pass "Suppressions (directives)" $suppressions_status "$tmp_dir/suppressions.log" "$write"
    [ -n "$markdown_pid" ] &&
        report_pass "Markdown (prose)" $markdown_status "$tmp_dir/markdown.log"
    selected names && report_pass "Names (tree)" $names_status "$tmp_dir/names.log" "$write"
    selected comments && report_pass "Comments (density)" $comments_status "$tmp_dir/comments.log" "$write"
    [ -n "$secrets_pid" ] && report_pass "Secrets (credentials)" $secrets_status "$tmp_dir/secrets.log"

    # A report, not a gate: only a rule turned off with no reason beside it fails the run.
    local drift_status=0
    if [ "$FIX_MODE" = false ] && selected drift; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} DRIFT ${NC} Deviations from the profile\n\n"
        node "$PACKAGE_ROOT/lint/checks/drift.js" . --oxlint "$OXLINT" "${OXLINT_CONFIG_ARGS[@]}" \
            --profiles "$PACKAGE_ROOT/src/presets/oxlint/profiles" \
            "${LINT_ARGS[@]}" "${DRIFT_ARGS[@]}"
        drift_status=$?
    fi

    if [ "$FIX_MODE" = true ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality fixes\n\n"
    else
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality checks\n\n"
    fi

    if [ $type_status -eq 0 ] && [ $lint_status -eq 0 ] && [ $format_status -eq 0 ] && [ $knip_status -eq 0 ] && [ $gitignore_status -eq 0 ] && [ $checker_status -eq 0 ] && [ $docs_layout_status -eq 0 ] && [ $markdown_status -eq 0 ] && [ $names_status -eq 0 ] && [ $comments_status -eq 0 ] && [ $secrets_status -eq 0 ] && [ $suppressions_status -eq 0 ] && [ $publish_status -eq 0 ] && [ $architecture_status -eq 0 ] && [ $astro_status -eq 0 ] && [ $drift_status -eq 0 ]; then
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
