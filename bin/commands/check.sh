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

add_tsgolint_to_path

# The config a consumer declares its rules in — the one thing that makes the
# drift report answerable. Without one there is no profile to have drifted from.
OXLINT_CONFIG=""
for candidate in oxlint.config.ts oxlint.config.mjs oxlint.config.js oxlint.config.cjs .oxlintrc.json; do
    [ -f "$candidate" ] && { OXLINT_CONFIG="$candidate"; break; }
done

# The ratchet's file, at the project root. Its presence is what turns the oxlint
# pass from "no diagnostic at all" into "no diagnostic above what was recorded".
BASELINE_FILE="oxlint.baseline.json"

TSC=$(find_tsc)
OXLINT=$(find_binary oxlint)
OXFMT=$(find_binary oxfmt)
KNIP=$(find_binary knip)
DEPCRUISE=$(find_binary depcruise)
PUBLINT=$(find_binary publint)
ATTW=$(find_binary attw)
PRETTIER=$(find_binary prettier)

# `astro` is the CONSUMER's dependency, never this package's: the pass runs its
# checker, it does not ship one. So the lookup starts at the project.
find_project_binary() {
    local name="$1"
    if [ -x "node_modules/.bin/$name" ]; then
        echo "$PWD/node_modules/.bin/$name"
    else
        find_binary "$name"
    fi
}

# The one file shape oxfmt does not parse. The values are the oxfmt values —
# 100 / 4 / single / all — so a consumer never declares a formatter of its own.
#
# The plugin is passed as a RESOLVED PATH, not as a name in the config: prettier
# resolves a plugin name from the working directory, which is the consumer's,
# and the consumer is precisely the project that no longer declares it.
PRETTIER_ASTRO_CONFIG="$PACKAGE_ROOT/presets/prettier/astro.json"
PRETTIER_ASTRO_PLUGIN=$(cd "$PACKAGE_ROOT" && node -e 'process.stdout.write(require.resolve("prettier-plugin-astro"))' 2>/dev/null)
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

# An Astro project, read off its manifest. `.astro` is the one file shape oxfmt
# does not parse and `astro check` is the only checker that reads a template's
# frontmatter, so the pass exists exactly where the dependency does.
project_uses_astro() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));const d={...p.dependencies,...p.devDependencies,...p.peerDependencies};process.exit(d["astro"]?0:1)' "$dir/package.json" 2>/dev/null
}

# A package the registry would accept: it names an entry (`exports`, `main`) or
# a publish target, and it never says it is private. A private package, and a
# workspace root that only holds members, have no tarball to be judged on.
project_is_publishable() {
    local dir="${1:-.}"
    [ -f "$dir/package.json" ] || return 1
    node -e 'const {readFileSync}=require("node:fs");const p=JSON.parse(readFileSync(process.argv[1],"utf8"));process.exit(p.private!==true&&(p.exports||p.main||p.publishConfig)?0:1)' "$dir/package.json" 2>/dev/null
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

# The name of the oxlint config, when that config is CommonJS — and nothing
# otherwise. Everything this package ships is ESM, and so is every oxlint JS
# plugin the estate writes; a CommonJS config cannot load either, and oxlint
# drops what it cannot load and still exits 0. The rules a config names are the
# whole claim of a lint run, so the shape of the config is the oxlint pass's
# business ([Quality checks](../../docs/06-quality-checks.md)).
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

# ── How a pass speaks ────────────────────────────────────────────────────────
# Every pass that RAN prints the same three things, in the same order: a `RUN`
# header carrying its label, whatever it has to say, and one verdict line. A
# pass that did not apply — no Astro in the project, no declared layer map —
# prints nothing at all, because it answered no question.
#
# What sits between the header and the verdict is the one variable: a failing
# pass prints its whole captured log, and a passing one stays silent unless it
# WROTE something. `fix` changed a file the operator owns and silence would hide
# it, so a writer asks for its log with the fourth argument; a reader's success
# chatter — which some tool builds print on Linux and not on macOS — never
# reaches the stream, so a green run is byte-identical everywhere.
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

# Two ways a lint run says nothing about the rules it was supposed to enforce.
#
# A config oxlint cannot parse — a `jsPlugins` naming a module that is not there
# is the common one — makes it print `Failed to parse oxlint configuration file`
# and lint nothing; 1.83.0 exits 1 for it, and this names the refusal in the
# toolchain's own vocabulary rather than leaving a reader with the tool's text.
# A CommonJS config is the silent one: oxlint drops it whole, prints NOTHING and
# exits 0, so the run is green having enforced no rule the config named.
#
# Both are the oxlint pass refusing, so both are written into its own log and
# both fail it. After this, `lint_status` is the verdict on what the linter
# actually ran, not on what it managed to exit with.
judge_lint_config() {
    local cjs
    cjs=$(commonjs_oxlint_config)
    local refusals=""

    if grep -q 'Failed to parse oxlint configuration file' "$tmp_dir/lint.log" 2>/dev/null; then
        refusals+="oxlint-config-unparsed  ${OXLINT_CONFIG}  oxlint refused this config and linted nothing — its own report is above"$'\n'
    fi
    if [ -n "$cjs" ]; then
        refusals+="oxlint-config-commonjs  ${cjs}  a CommonJS config cannot load an ESM preset or plugin, and oxlint drops what it cannot load — write oxlint.config.ts or .mjs"$'\n'
    fi

    [ -z "$refusals" ] && return 0

    printf '%s' "$refusals" >> "$tmp_dir/lint.log"
    lint_status=1
}

# One pass, N runs: the logs of the runs that FAILED, joined into the single log
# the pass reports under. A green member stays silent — it is the same pass.
join_logs() {
    local into="$1"
    shift
    : > "$into"
    local log
    for log in "$@"; do
        [ -s "$log" ] && cat "$log" >> "$into"
    done
}

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

    # --type-aware is explicit and unconditional: the rules it unlocks are the
    # ones no syntactic linter can express, and a flag that is only sometimes
    # passed is a rule set that is only sometimes enforced. `oxlint-tsgolint` is
    # a dependency of this package, so it is there for every consumer.
    if [ "$FIX_MODE" = true ]; then
        "$OXLINT" --type-aware --fix "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    else
        "$OXLINT" --type-aware "${LINT_ARGS[@]}" > "$tmp_dir/lint.log" 2>&1 &
    fi
    local lint_pid=$!

    # The same run, machine-readable, so the ratchet can be judged rule by rule.
    # A second invocation rather than a reformat of the first: the human log is
    # what a failing pass prints, and neither form can be derived from the other.
    local lint_json_pid=""
    if [ "$FIX_MODE" = false ] && [ -f "$BASELINE_FILE" ]; then
        "$OXLINT" --type-aware --format json "${LINT_ARGS[@]}" \
            > "$tmp_dir/lint.json" 2>/dev/null &
        lint_json_pid=$!
    fi

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
    #
    # Deliberately UNCACHED. Knip's `--cache` validates a cached glob against the
    # mtimes of the directories that held a match; a file added to a directory
    # that held none is invisible to it, and the run exits 0 where the uncached
    # run exits 1. A gate that can pass on stale knowledge is worse than a slow one.
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

    # Gitignore (artefacts): the convention — every artefact under
    # `.artifacts/<tool>/`, `dist` excepted — read off the project's own
    # `.gitignore` AND, in check mode, the nearest ancestor `.gitignore` above it
    # (the workspace root's — check-gitignore.js walks up to find it). Opt-in by
    # existence: neither file names an artefact path, the gate has no question to
    # ask. A workspace whose `lint` delegates to members needs the ancestor probed
    # here, in bash, because it decides whether to print the pass at all — the
    # node script decides everything past that. Fix mode stays own-file-only: it
    # is the one gate whose remedy is a rewrite, and it never rewrites another
    # project's `.gitignore`.
    local gitignore_pid=""
    local gitignore_status=0
    local gitignore_applicable=false
    if [ -f ".gitignore" ]; then
        gitignore_applicable=true
    elif [ "$FIX_MODE" = false ] && node "$PACKAGE_ROOT/lib/check-gitignore.js" --has-ancestor > /dev/null 2>&1; then
        gitignore_applicable=true
    fi
    if [ "$gitignore_applicable" = true ]; then
        if [ "$FIX_MODE" = true ]; then
            node "$PACKAGE_ROOT/lib/check-gitignore.js" --fix > "$tmp_dir/gitignore.log" 2>&1 &
        else
            node "$PACKAGE_ROOT/lib/check-gitignore.js" > "$tmp_dir/gitignore.log" 2>&1 &
        fi
        gitignore_pid=$!
    fi

    # Docs (layout): the manual's shape — the map, the spine, the numbering, the
    # three subfolders, the decision mold. Its unit is the REPOSITORY, not the
    # package: a manual answers for the whole tree, and only its root carries the
    # AGENTS.md that routes into it. So the pass asks its question exactly where a
    # repository is — `.git` here, a file in a worktree and a directory in a clone.
    # Nothing else gates it: a repository with NO docs/ is the population the rule
    # exists for, and it fails on `docs-absent`. Check-only, like every read-only
    # gate — there is no rewrite that can author a chapter.
    local docs_layout_pid=""
    local docs_layout_status=0
    if [ "$FIX_MODE" = false ] && [ -e ".git" ]; then
        node "$PACKAGE_ROOT/lib/check-docs.js" > "$tmp_dir/docs-layout.log" 2>&1 &
        docs_layout_pid=$!
    fi

    # Suppressions (directives): every place the project told a checker to look
    # away is spelled in this toolchain's vocabulary, carries its reason, and
    # names a rule that is still live. It runs in BOTH modes — `--fix` settles
    # the two spellings a machine can settle, and never invents a reason.
    local suppressions_pid=""
    local suppressions_status=0
    local suppressions_fix=()
    [ "$FIX_MODE" = true ] && suppressions_fix=(--fix)
    node "$PACKAGE_ROOT/lib/check-suppressions.js" . --oxlint "$OXLINT" \
        "${suppressions_fix[@]}" "${LINT_ARGS[@]}" > "$tmp_dir/suppressions.log" 2>&1 &
    suppressions_pid=$!

    # Markdown (prose): every tracked page's coordinates resolve, and its blocks
    # breathe. Check-only — there is no rewrite that splits a paragraph into the
    # two ideas it was carrying. It reads the same `--ignore-pattern` globs the
    # linter received, so one flag answers for the whole run.
    local markdown_pid=""
    local markdown_status=0
    if [ "$FIX_MODE" = false ]; then
        node "$PACKAGE_ROOT/lib/check-markdown.js" . "${LINT_ARGS[@]}" \
            > "$tmp_dir/markdown.log" 2>&1 &
        markdown_pid=$!
    fi

    # Names: what the project calls its own parts, under the roots where a
    # project keeps what it wrote. Check-only — renaming a file is a move, and
    # choosing the name it moves to is the work the rule is asking for.
    local names_pid=""
    local names_status=0
    if [ "$FIX_MODE" = false ]; then
        node "$PACKAGE_ROOT/lib/check-names.js" . "${LINT_ARGS[@]}" > "$tmp_dir/names.log" 2>&1 &
        names_pid=$!
    fi

    # Secrets: no file the project would commit carries a live-looking
    # credential. The gate always applies, so WHICH engine answers — gitleaks
    # where the machine has it, the built-in patterns where it does not — is
    # decided inside the script, not here.
    local secrets_pid=""
    local secrets_status=0
    if [ "$FIX_MODE" = false ]; then
        node "$PACKAGE_ROOT/lib/check-secrets.js" . "${LINT_ARGS[@]}" \
            > "$tmp_dir/secrets.log" 2>&1 &
        secrets_pid=$!
    fi

    # Astro: the consumer's own checker, plus the formatter for the one file
    # shape oxfmt does not parse. Both halves run in fix mode too — prettier
    # writes there, and `astro check` is read-only wherever it runs.
    local astro_pid=""
    local astro_status=0
    if project_uses_astro "."; then
        ASTRO=$(find_project_binary astro)
        # A subshell, so both halves run and both are reported — a template that
        # does not type-check is not a reason to stay quiet about its shape.
        # `local` has no meaning past the `&`, hence the plain names.
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

    # Architecture (layer map): the graph a project declared, resolved. Bash
    # asks the one question that decides whether the gate applies at all — is
    # there a map — and the script decides what it says. Opt-in by the file's
    # existence: a project with no declared architecture is not in breach of one.
    local architecture_pid=""
    local architecture_status=0
    if [ "$FIX_MODE" = false ] &&
        { [ -f ".dependency-cruiser.cjs" ] || [ -f ".dependency-cruiser.js" ] ||
            [ -f ".dependency-cruiser.mjs" ]; }; then
        node "$PACKAGE_ROOT/lib/check-architecture.js" . --depcruise "$DEPCRUISE" \
            > "$tmp_dir/architecture.log" 2>&1 &
        architecture_pid=$!
    fi

    # Publish (packaging): what a published package promises, held to what the
    # tarball will contain. Once per package the registry would accept — the
    # unit is the workspace package, and a private one has no tarball.
    local publish_pids=()
    local publish_logs=()
    local publish_status=0
    if [ "$FIX_MODE" = false ]; then
        local publish_index=0
        for publish_root in "." "${WORKSPACE_MEMBERS[@]}"; do
            project_is_publishable "$publish_root" || continue
            node "$PACKAGE_ROOT/lib/check-publish.js" "$publish_root" \
                --publint "$PUBLINT" --attw "$ATTW" \
                > "$tmp_dir/publish-$publish_index.log" 2>&1 &
            publish_pids+=($!)
            publish_logs+=("$tmp_dir/publish-$publish_index.log")
            publish_index=$((publish_index + 1))
        done
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

    # The ratchet, where the project keeps one: the pass is judged by what the
    # baseline tolerates, not by oxlint's exit code. Bash decides whether the
    # file is there; the script decides what it says.
    if [ -n "$lint_json_pid" ]; then
        wait $lint_json_pid
        node "$PACKAGE_ROOT/lib/check-baseline.js" "$tmp_dir/lint.json" . \
            >> "$tmp_dir/lint.log" 2>&1
        lint_status=$?
    fi

    wait $format_pid; local format_status=$?
    [ -n "$knip_pid" ] && { wait $knip_pid; knip_status=$?; }
    [ -n "$gitignore_pid" ] && { wait $gitignore_pid; gitignore_status=$?; }
    [ -n "$docs_layout_pid" ] && { wait $docs_layout_pid; docs_layout_status=$?; }
    wait $suppressions_pid; suppressions_status=$?
    [ -n "$markdown_pid" ] && { wait $markdown_pid; markdown_status=$?; }
    [ -n "$architecture_pid" ] && { wait $architecture_pid; architecture_status=$?; }
    [ -n "$astro_pid" ] && { wait $astro_pid; astro_status=$?; }
    [ -n "$names_pid" ] && { wait $names_pid; names_status=$?; }
    [ -n "$secrets_pid" ] && { wait $secrets_pid; secrets_status=$?; }

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

    local publish_failed_logs=()
    index=0
    for pid in "${publish_pids[@]}"; do
        if ! wait "$pid"; then
            publish_status=1
            publish_failed_logs+=("${publish_logs[$index]}")
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

    # ── The report ───────────────────────────────────────────────────────────
    # One order, and it is the chapter's: the three tools, the artefact gate,
    # knip, the conventions checker, the two Docs passes, then the gates a
    # project opts into and the four that read its tree on every run. A pass
    # that did not apply is absent; every pass that ran prints the same block.
    join_logs "$tmp_dir/checker.log" "${checker_failed_logs[@]}"
    join_logs "$tmp_dir/docs.log" "${docs_failed_logs[@]}"
    join_logs "$tmp_dir/publish.log" "${publish_failed_logs[@]}"

    local lint_label="Oxlint Check"
    local format_label="Oxfmt Check"
    local write=""
    if [ "$FIX_MODE" = true ]; then
        lint_label="Oxlint Fix"
        format_label="Oxfmt Format"
        write="writer"
    fi

    judge_lint_config
    report_pass "TypeScript Check" $type_status "$tmp_dir/type.log"
    report_pass "$lint_label" $lint_status "$tmp_dir/lint.log"
    report_pass "$format_label" $format_status "$tmp_dir/format.log"
    [ -n "$gitignore_pid" ] &&
        report_pass "Gitignore (artefacts)" $gitignore_status "$tmp_dir/gitignore.log" writer
    [ "$FIX_MODE" = false ] &&
        report_pass "Knip (unused code)" $knip_status "$tmp_dir/knip.log"
    [ ${#checker_pids[@]} -gt 0 ] &&
        report_pass "Test Conventions (@jterrazz/test)" $checker_status "$tmp_dir/checker.log"
    [ -n "$docs_layout_pid" ] &&
        report_pass "Docs (layout)" $docs_layout_status "$tmp_dir/docs-layout.log"
    [ ${#docs_pids[@]} -gt 0 ] &&
        report_pass "Docs (sync)" $docs_status "$tmp_dir/docs.log"
    [ ${#publish_pids[@]} -gt 0 ] &&
        report_pass "Publish (packaging)" $publish_status "$tmp_dir/publish.log"
    [ -n "$architecture_pid" ] &&
        report_pass "Architecture (layer map)" $architecture_status "$tmp_dir/architecture.log"
    [ -n "$astro_pid" ] &&
        report_pass "Astro (check + format)" $astro_status "$tmp_dir/astro.log" "$write"
    report_pass "Suppressions (directives)" $suppressions_status "$tmp_dir/suppressions.log" "$write"
    [ -n "$markdown_pid" ] &&
        report_pass "Markdown (prose)" $markdown_status "$tmp_dir/markdown.log"
    [ -n "$names_pid" ] && report_pass "Names (tree)" $names_status "$tmp_dir/names.log"
    [ -n "$secrets_pid" ] && report_pass "Secrets (credentials)" $secrets_status "$tmp_dir/secrets.log"

    # Drift: the report, not a gate — how far this project stands from the
    # profile it says it extends, in four numbers. It runs last and it speaks on
    # every check, because the alternative is what the estate had: every
    # repository quietly a little further from the shared rulebook, and nobody
    # able to say by how much without opening every config. Only a rule turned
    # off with no reason beside it actually fails the run.
    local drift_status=0
    if [ "$FIX_MODE" = false ] && [ -n "$OXLINT_CONFIG" ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} DRIFT ${NC} Deviations from the profile\n\n"
        node "$PACKAGE_ROOT/lib/check-drift.js" . --oxlint "$OXLINT" "${LINT_ARGS[@]}"
        drift_status=$?
    fi

    # Summary
    if [ "$FIX_MODE" = true ]; then
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality fixes\n\n"
    else
        printf "\n${CYAN_BG}${BRIGHT_WHITE} END ${NC} Finalizing quality checks\n\n"
    fi

    if [ $type_status -eq 0 ] && [ $lint_status -eq 0 ] && [ $format_status -eq 0 ] && [ $knip_status -eq 0 ] && [ $gitignore_status -eq 0 ] && [ $checker_status -eq 0 ] && [ $docs_layout_status -eq 0 ] && [ $docs_status -eq 0 ] && [ $markdown_status -eq 0 ] && [ $names_status -eq 0 ] && [ $secrets_status -eq 0 ] && [ $suppressions_status -eq 0 ] && [ $publish_status -eq 0 ] && [ $architecture_status -eq 0 ] && [ $astro_status -eq 0 ] && [ $drift_status -eq 0 ]; then
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
