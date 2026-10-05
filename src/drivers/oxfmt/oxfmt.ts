import { OXFMT_CONFIG_NAMES } from '../../../lint/kit/project/editor-config-names.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { editorConfigOf } from '../editor-config.js';
import type { ToolConfig } from '../editor-config.js';
import { run } from '../run.js';

export const oxfmtBinary = (fallbackBin = HOISTED_BESIDE_PACKAGE): string =>
    binaryIn('oxfmt', fallbackBin);

export const oxfmtConfig = (): ToolConfig =>
    editorConfigOf(OXFMT_CONFIG_NAMES, 'dist/oxfmt-standin.js');

// outside: oxfmt fails a path list that matches nothing, which a subset of the project may.
const targetsOf = (paths: readonly string[]): string[] =>
    paths.length === 0 ? [] : ['--no-error-on-unmatched-pattern', ...paths];

/** Formats `paths`, or the whole project where there are none, its report written to `log`. */
export async function formatted(
    binary: string,
    args: readonly string[],
    paths: readonly string[],
    log: string,
): Promise<number> {
    return await run(binary, [...args, ...targetsOf(paths)], {
        stderr: 'stdout',
        stdout: { path: log },
    });
}

/** Formats `files` alone, what oxfmt prints dropped. */
export async function filesFormatted(
    binary: string,
    args: readonly string[],
    ...files: string[]
): Promise<number> {
    return await run(binary, [...args, ...targetsOf(files)], {
        stderr: 'ignore',
        stdout: 'ignore',
    });
}
