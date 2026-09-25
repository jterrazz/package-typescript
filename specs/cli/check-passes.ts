import { resolve } from 'node:path';

/*
 * A chain that asserts on some passes of `typescript check` runs those alone:
 * it runs the product command through the selector, which reads
 * `TYPESCRIPT_CHECK_PASSES`, and a pass it leaves out prints nothing and
 * weighs nothing in the verdict (docs/03-testing.md, "Who a rule is for").
 */

/** The product command as the specs run it: `bin/typescript.sh`, unless a selection names some passes of `check` or `fix`. */
export const SELECTING_BIN = resolve(import.meta.dirname, 'check-selection.sh');

/** A key of the selector — one per pass the check knows. */
type Pass =
    | 'architecture'
    | 'astro'
    | 'comments'
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

/** The variable that has `SELECTING_BIN` run only `passes`, to spread into a run's environment. */
export function onlyPasses(...passes: [Pass, ...Pass[]]): { TYPESCRIPT_CHECK_PASSES: string } {
    return { TYPESCRIPT_CHECK_PASSES: passes.join(',') };
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
