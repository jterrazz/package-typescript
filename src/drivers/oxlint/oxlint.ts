import { existsSync, realpathSync } from 'node:fs';
import { basename, delimiter, dirname } from 'node:path';
import process from 'node:process';

import { OXLINT_CONFIG_NAMES } from '../../../lint/kit/project/editor-config-names.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { editorConfigOf } from '../editor-config.js';
import type { ToolConfig } from '../editor-config.js';
import { run } from '../run.js';

export const oxlintBinary = (fallbackBin = HOISTED_BESIDE_PACKAGE): string =>
    binaryIn('oxlint', fallbackBin);

export const oxlintConfig = (): ToolConfig =>
    editorConfigOf(OXLINT_CONFIG_NAMES, 'dist/oxlint-standin.js');

/** Puts the tsgolint oxlint's type-aware rules spawn first on the PATH, where oxlint looks for it. */
export function withTsgolintOnPath(fallbackBin = HOISTED_BESIDE_PACKAGE): void {
    const tsgolint = binaryIn('tsgolint', fallbackBin);
    if (tsgolint.includes('/') && existsSync(tsgolint)) {
        process.env.PATH = `${realpathSync(dirname(tsgolint))}${delimiter}${process.env.PATH ?? ''}`;
    }
}

/** Lints with `args`, the config's arguments, the caller's and the targets, its report appended to `log`. */
export async function linted(
    binary: string,
    args: readonly string[],
    log: string,
): Promise<number> {
    return await run(binary, args, { stderr: 'stdout', stdout: { append: true, path: log } });
}

/** Applies the fixes under `wrapper`, the config that turns the unsafe fixers off, which oxlint must not lint itself. */
export async function fixedUnder(
    binary: string,
    wrapper: string,
    args: readonly string[],
    log: string,
): Promise<number> {
    return await linted(
        binary,
        ['--type-aware', '--fix', '-c', wrapper, '--ignore-pattern', basename(wrapper), ...args],
        log,
    );
}

/** Writes oxlint's suppressions file: every report suppressed, then the suppressions no report needs pruned. */
export async function suppressionsRecorded(
    binary: string,
    config: readonly string[],
    args: readonly string[],
    targets: readonly string[],
): Promise<void> {
    for (const recording of ['--suppress-all', '--prune-suppressions']) {
        await run(binary, [...config, '--type-aware', recording, ...args, ...targets], {
            stderr: 'ignore',
            stdout: 'ignore',
        });
    }
}
