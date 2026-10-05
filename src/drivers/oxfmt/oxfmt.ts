import { OXFMT_CONFIG_NAMES } from '../../../lint/kit/project/editor-config-names.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { editorConfigOf } from '../editor-config.js';
import type { ToolConfig } from '../editor-config.js';
import { run } from '../run.js';
import type { Spawned } from '../run.js';

export const oxfmtBinary = (fallbackBin = HOISTED_BESIDE_PACKAGE): string =>
    binaryIn('oxfmt', fallbackBin);

export const oxfmtConfig = (): ToolConfig =>
    editorConfigOf(OXFMT_CONFIG_NAMES, 'dist/oxfmt-standin.js');

export async function runOxfmt(
    binary: string,
    args: readonly string[],
    spawned: Spawned,
): Promise<number> {
    return await run(binary, args, spawned);
}
