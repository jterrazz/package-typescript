#!/bin/bash
# The published package holds no copy of this selector. It replaces check.sh's `selected` and its own-directory
# line when TYPESCRIPT_CHECK_PASSES names passes; a pass another reads still runs, unreported.
ROOT="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BIN="$ROOT/bin/typescript.sh"
CHECK="$ROOT/bin/commands/check.sh"
SELECTED_PASSES="${TYPESCRIPT_CHECK_PASSES:-}"

case "${1:-}" in
    check | fix) [ -n "$SELECTED_PASSES" ] || exec bash "$BIN" "$@" ;;
    *) exec bash "$BIN" "$@" ;;
esac

read -r -a ALL_PASSES <<< "$(node -e 'const {readFileSync}=require("node:fs");process.stdout.write(JSON.parse(readFileSync(process.argv[1],"utf8")).filter((row)=>row.channel==="checker"&&row.audience==="consumer").map((row)=>row.id).join(" "))' "$ROOT/lint/consumer/catalogue/manifest.json")"
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
