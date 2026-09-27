import { writeFileSync } from 'node:fs';
import process from 'node:process';

import { run } from '../processes.js';
import type { Stream } from '../processes.js';
import { CHECKER } from '../toolchain.js';
import type { Check } from './setup.js';

const TYPELESS_WARNING = '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON';

export async function checker(
    pass: string,
    args: readonly string[],
    log: Stream,
    { typeless = false }: { typeless?: boolean } = {},
): Promise<number> {
    return await run(
        process.execPath,
        [...(typeless ? [TYPELESS_WARNING] : []), CHECKER, pass, ...args],
        {
            stderr: 'stdout',
            stdout: log,
        },
    );
}

export async function oxlint(
    check: Check,
    args: readonly string[],
    streams: { stderr: Stream; stdout: Stream },
): Promise<number> {
    if (check.lintTargets.nothing) {
        if (args.join(' ').includes('--format json') && typeof streams.stdout === 'object') {
            writeFileSync(streams.stdout.path, '{ "diagnostics": [] }\n');
        }

        return 0;
    }

    return await run(
        check.tools.oxlint,
        [...check.configs.oxlint.args, ...args, ...check.lintTargets.paths],
        streams,
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
