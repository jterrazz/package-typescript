import type { OxfmtConfig } from 'oxfmt';

import { readSettings } from '../../../lint/index.rules.js';
import { keptByteForByte } from '../../../lint/kit/project/byte-for-byte.js';
import style from './style.js';

export async function oxfmtConfigAt(unit: string): Promise<OxfmtConfig> {
    const { resolved } = await readSettings(unit);

    return { ...style, ignorePatterns: keptByteForByte(resolved.sections.typescript) };
}
