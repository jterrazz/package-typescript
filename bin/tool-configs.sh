# The config oxlint and oxfmt run with — sourced, never run, from the project
# root. A project that keeps a config of its own is left to it, and the tool
# finds it where it looks. A project with none is handed the toolchain's
# default, the `node` profile and the formatting preset, by path — so neither
# tool walks up the tree for a config that belongs to whatever folder the
# project happens to sit in.
#
# A config handed by path resolves its `ignorePatterns` against its own
# directory, which is this package's, so they reach nothing in the project.
# The sweep a tool is handed applies them instead: `lint-targets.js` takes the
# default's path with `--ignores-of` and leaves out what its patterns name.
#
# `PACKAGE_ROOT` is the caller's, resolved before this file is sourced.

# The project's own oxlint config, in the order oxlint looks for one — the
# names of `src/cli/oxlint-config-names.json`, the one list this file and
# `check-drift.js` both read, so a project counts as having a config in the
# drift report exactly when it does here.
OXLINT_CONFIG=""
while IFS= read -r candidate; do
    [ -f "$candidate" ] && { OXLINT_CONFIG="$candidate"; break; }
done < <(node -e 'const {readFileSync}=require("node:fs");for(const n of JSON.parse(readFileSync(process.argv[1],"utf8")))process.stdout.write(n+"\n")' "$PACKAGE_ROOT/src/cli/oxlint-config-names.json")
OXFMT_CONFIG=""
for candidate in .oxfmtrc.json .oxfmtrc.jsonc oxfmt.config.ts oxfmt.config.mts; do
    [ -f "$candidate" ] && { OXFMT_CONFIG="$candidate"; break; }
done

DEFAULT_OXLINT_CONFIG="$PACKAGE_ROOT/src/presets/oxlint/profiles/node.js"
DEFAULT_OXFMT_CONFIG="$PACKAGE_ROOT/src/presets/oxfmt/index.js"

# What each tool is handed ahead of its files, and what its sweep is handed.
OXLINT_CONFIG_ARGS=()
OXLINT_TARGET_ARGS=()
if [ -z "$OXLINT_CONFIG" ]; then
    OXLINT_CONFIG_ARGS=(-c "$DEFAULT_OXLINT_CONFIG")
    OXLINT_TARGET_ARGS=(--ignores-of "$DEFAULT_OXLINT_CONFIG")
fi
OXFMT_CONFIG_ARGS=()
OXFMT_TARGET_ARGS=()
if [ -z "$OXFMT_CONFIG" ]; then
    OXFMT_CONFIG_ARGS=(-c "$DEFAULT_OXFMT_CONFIG")
    OXFMT_TARGET_ARGS=(--ignores-of "$DEFAULT_OXFMT_CONFIG")
fi
