import { resolve } from 'node:path';

import type { CheckPass } from '../../../src/command/check/passes.js';

export const SELECTING_BIN = resolve(import.meta.dirname, 'check-selection.ts');

export function onlyPasses(...passes: [CheckPass, ...CheckPass[]]): {
    TYPESCRIPT_CHECK_PASSES: string;
} {
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
