import { writeFileSync } from 'node:fs';

import { formatted } from '../../../drivers/oxfmt/oxfmt.js';
import { linted } from '../../../drivers/oxlint/oxlint.js';
import type { Check } from './setup.js';

export async function oxlint(check: Check, args: readonly string[], log: string): Promise<number> {
    if (check.lintTargets.nothing) {
        return 0;
    }

    return await linted(
        check.tools.oxlint,
        [...check.configs.oxlint.args, ...args, ...check.lintTargets.paths],
        log,
    );
}

export async function oxfmt(check: Check, args: readonly string[], log: string): Promise<number> {
    if (check.formatTargets.nothing) {
        writeFileSync(log, '');

        return 0;
    }

    return await formatted(
        check.tools.oxfmt,
        [...check.configs.oxfmt.args, ...args],
        check.formatTargets.paths,
        log,
    );
}
