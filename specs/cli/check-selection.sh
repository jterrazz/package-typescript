# shellcheck shell=bash
# The `pass-selector` rule, sourced by bash itself before the first line of
# every script it runs, through the file `BASH_ENV` names — which only this
# repository's specs set. It defines the `selected` that `check.sh` asks
# about each pass; the published package holds no copy.
#
# Every pass, unless TYPESCRIPT_CHECK_PASSES names some, comma-separated. A
# pass left out prints nothing and weighs nothing in the verdict. A pass
# another one reads still runs, unreported: the linter's report under the
# member runs of the conventions checker, and the Names report under the
# ratchet's held line. The passes it may name are the `consumer` rows of the
# checker channel of `specs/surface/package/rules.json`, read only when a
# selection needs checking.
SELECTED_PASSES="${TYPESCRIPT_CHECK_PASSES:-}"
if [ -n "$SELECTED_PASSES" ]; then
    read -r -a ALL_PASSES <<< "$(node -e 'const {readFileSync}=require("node:fs");process.stdout.write(JSON.parse(readFileSync(process.argv[1],"utf8")).filter((row)=>row.channel==="checker"&&row.audience==="consumer").map((row)=>row.id).join(" "))' "$(dirname "${BASH_SOURCE[0]}")/../surface/package/rules.json")"
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
