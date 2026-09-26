import { resolve } from 'node:path';

export const SELECTING_BIN = resolve(import.meta.dirname, '../check-selection.sh');

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

export function onlyPasses(...passes: [Pass, ...Pass[]]): { TYPESCRIPT_CHECK_PASSES: string } {
    return { TYPESCRIPT_CHECK_PASSES: passes.join(',') };
}

export function passOf(stdout: string, label: string): string {
    const start = stdout.indexOf(label);
    if (start === -1) {
        return '';
    }
    const end = stdout.slice(start).search(/ (?:RUN|DRIFT|END) /u);

    return stdout.slice(start, start + end);
}
