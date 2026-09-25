# shellcheck shell=bash
# Sourced by check.sh, in this repository's checkout alone: `files` leaves it
# out of the published package, where every pass runs.
#
# Every pass, unless TYPESCRIPT_CHECK_PASSES names some, comma-separated — an
# internal selector, for the specs that assert on one pass. A pass left out
# prints nothing and weighs nothing in the verdict. A pass another one reads
# still runs, unreported: the linter's report under the member runs of the
# conventions checker, and the Names report under the ratchet's held line.
# The passes it may name are the rows of `src/cli/check-passes.json`, each
# with the audience it serves, read only when a selection needs checking.
SELECTED_PASSES="${TYPESCRIPT_CHECK_PASSES:-}"
if [ -n "$SELECTED_PASSES" ]; then
    read -r -a ALL_PASSES <<< "$(node -e 'const {readFileSync}=require("node:fs");process.stdout.write(JSON.parse(readFileSync(process.argv[1],"utf8")).map((row)=>row.pass).join(" "))' "$PACKAGE_ROOT/src/cli/check-passes.json")"
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
fi

selected() {
    [ -z "$SELECTED_PASSES" ] || [[ ",$SELECTED_PASSES," == *",$1,"* ]]
}
