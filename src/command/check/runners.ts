import { writeFileSync } from 'node:fs';

import { run } from '../processes.js';
import type { Stream } from '../processes.js';
import { EMPTY_REPORT } from '../report/diagnostic.js';
import type { Check } from './setup.js';

export async function oxlintJson(
    check: Check,
    args: readonly string[],
    { report, stderr }: { report: string; stderr: Stream },
): Promise<number> {
    if (check.lintTargets.nothing) {
        writeFileSync(report, EMPTY_REPORT);

        return 0;
    }

    return await run(
        check.tools.oxlint,
        [...check.configs.oxlint.args, ...args, '--format', 'json', ...check.lintTargets.paths],
        { stderr, stdout: { path: report } },
    );
}

// A list holding only shapes oxfmt does not parse is nothing to format, not an error.
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
