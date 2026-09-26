# A config handed by path resolves its `ignorePatterns` against this package's directory, where they reach
# nothing: `lint-targets.js --ignores-of` applies them to the sweep instead. `PACKAGE_ROOT` is the caller's.

# Captured whole rather than streamed: a `break` closing the pipe early left `node` writing into EPIPE.
OXLINT_CONFIG_NAMES=$(node -e 'const {readFileSync}=require("node:fs");process.stdout.write(JSON.parse(readFileSync(process.argv[1],"utf8")).join(" "))' "$PACKAGE_ROOT/lint/reading/oxlint-config-names.json")
OXLINT_CONFIG=""
for candidate in $OXLINT_CONFIG_NAMES; do
    [ -f "$candidate" ] && { OXLINT_CONFIG="$candidate"; break; }
done
OXFMT_CONFIG=""
for candidate in .oxfmtrc.json .oxfmtrc.jsonc oxfmt.config.ts oxfmt.config.mts; do
    [ -f "$candidate" ] && { OXFMT_CONFIG="$candidate"; break; }
done

DEFAULT_OXLINT_CONFIG="$PACKAGE_ROOT/src/presets/oxlint/profiles/node.js"
DEFAULT_OXFMT_CONFIG="$PACKAGE_ROOT/src/presets/oxfmt/index.js"

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
