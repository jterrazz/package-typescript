import { writeFileSync } from 'node:fs';

import { run } from '../processes.js';
import type { Check } from './setup.js';

export async function oxlint(check: Check, args: readonly string[], log: string): Promise<number> {
    if (check.lintTargets.nothing) {
        return 0;
    }

    return await run(
        check.tools.oxlint,
        [...check.configs.oxlint.args, ...args, ...check.lintTargets.paths],
        { stderr: 'stdout', stdout: { append: true, path: log } },
    );
}

export async function oxfmt(check: Check, args: readonly string[], log: string): Promise<number> {
    if (check.formatTargets.nothing) {
        writeFileSync(log, '');

        return 0;
    }
    const targets =
        check.formatTargets.paths.length === 0
            ? []
            : ['--no-error-on-unmatched-pattern', ...check.formatTargets.paths];

    return await run(check.tools.oxfmt, [...check.configs.oxfmt.args, ...args, ...targets], {
        stderr: 'stdout',
        stdout: { path: log },
    });
}
