import { resolve } from 'node:path';

/*
 * A chain that asserts on some passes of `typescript check` runs those alone:
 * `TYPESCRIPT_CHECK_PASSES` is read by the selector bash sources through
 * `BASH_ENV`, and a pass it leaves out prints nothing and weighs nothing in
 * the verdict (docs/03-testing.md, "Who a rule is for").
 */

/** The selector's one copy, which bash sources before every script it runs. */
export const SELECTION = resolve(import.meta.dirname, 'check-selection.sh');

/** A key of the selector — one per pass the check knows. */
type Pass =
    | 'architecture'
    | 'astro'
    | 'conventions'
    | 'docs'
    | 'drift'
    | 'gitignore'
    | 'knip'
    | 'markdown'
    | 'names'
    | 'oxfmt'
    | 'oxlint'
    | 'publish'
    | 'secrets'
    | 'suppressions'
    | 'typescript';

/** The variables that run only `passes`, to spread into a run's environment. */
export function onlyPasses(...passes: [Pass, ...Pass[]]): {
    BASH_ENV: string;
    TYPESCRIPT_CHECK_PASSES: string;
} {
    return { BASH_ENV: SELECTION, TYPESCRIPT_CHECK_PASSES: passes.join(',') };
}

/** What a run printed from `label` to the next header — the next pass's, the drift report's, or the run's end. */
export function passOf(stdout: string, label: string): string {
    const start = stdout.indexOf(label);
    if (start === -1) {
        return '';
    }
    const end = stdout.slice(start).search(/ (?:RUN|DRIFT|END) /u);

    return stdout.slice(start, start + end);
}
