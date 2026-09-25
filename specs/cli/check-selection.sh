#!/bin/bash
# The `pass-selector` rule: the product command as this repository's specs
# run it. The published package holds no copy, and nothing in an install's
# environment reaches it.
#
# Every command goes to `bin/typescript.sh` untouched, unless it is `check` or
# `fix` and TYPESCRIPT_CHECK_PASSES names some passes, comma-separated. Then
# the published `bin/commands/check.sh` runs from its text, with two lines
# replaced: its every-pass `selected`, by one that answers for the passes
# named, and its own directory, which a script read from text cannot find. A
# pass left out prints nothing and weighs nothing in the verdict. A pass
# another one reads still runs, unreported: the linter's report under the
# member runs of the conventions checker, and the Names report under the
# ratchet's held line. The passes it may name are the `consumer` rows of the
# checker channel of `specs/surface/package/rules.json`.
ROOT="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="$ROOT/bin/typescript.sh"
CHECK="$ROOT/bin/commands/check.sh"
SELECTED_PASSES="${TYPESCRIPT_CHECK_PASSES:-}"

case "${1:-}" in
    check | fix) [ -n "$SELECTED_PASSES" ] || exec bash "$BIN" "$@" ;;
    *) exec bash "$BIN" "$@" ;;
esac

read -r -a ALL_PASSES <<< "$(node -e 'const {readFileSync}=require("node:fs");process.stdout.write(JSON.parse(readFileSync(process.argv[1],"utf8")).filter((row)=>row.channel==="checker"&&row.audience==="consumer").map((row)=>row.id).join(" "))' "$ROOT/specs/surface/package/rules.json")"
IFS=',' read -r -a requested_passes <<< "$SELECTED_PASSES"
for requested_pass in "${requested_passes[@]}"; do
    case " ${ALL_PASSES[*]} " in
        *" $requested_pass "*) ;;
        *)
            printf 'TYPESCRIPT_CHECK_PASSES names no pass: %s — the passes are %s\n' \
                "$requested_pass" "$(IFS=','; printf '%s' "${ALL_PASSES[*]}")" >&2
            exit 2
            ;;
    esac
done

SELECTING='selected() { [[ ",$TYPESCRIPT_CHECK_PASSES," == *",$1,"* ]]; }'
SCRIPT_DIR_LINE='SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"'
SCRIPT=$(awk -v selecting="$SELECTING" -v script_dir_line="$SCRIPT_DIR_LINE" -v script_dir="$ROOT/bin/commands" '
    $0 == script_dir_line { print "SCRIPT_DIR=\"" script_dir "\""; directories++; next }
    $0 == "selected() {" { skipping = 1; next }
    skipping && $0 == "}" { print selecting; skipping = 0; selectors++; next }
    skipping { next }
    { print }
    END { if (directories != 1 || selectors != 1) exit 1 }
' "$CHECK") || {
    printf 'bin/commands/check.sh no longer holds one `selected() {` block and one SCRIPT_DIR line to replace\n' >&2
    exit 2
}
exec bash -c "$SCRIPT" "$CHECK" "$@"
