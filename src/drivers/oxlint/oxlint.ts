import { existsSync, realpathSync } from 'node:fs';
import { delimiter, dirname } from 'node:path';
import process from 'node:process';

import { OXLINT_CONFIG_NAMES } from '../../../lint/kit/project/editor-config-names.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { editorConfigOf } from '../editor-config.js';
import type { ToolConfig } from '../editor-config.js';
import { run } from '../run.js';
import type { Spawned } from '../run.js';

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

export async function runOxlint(
    binary: string,
    args: readonly string[],
    spawned: Spawned,
): Promise<number> {
    return await run(binary, args, spawned);
}
