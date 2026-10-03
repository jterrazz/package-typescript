import type { OxfmtConfig } from 'oxfmt';

import { readSettings } from '../../../lint/index.rules.js';
import { objectOf } from '../../../lint/kit/project/json.js';
import style from './style.js';

export async function oxfmtConfig(unit: string): Promise<OxfmtConfig> {
    const { resolved } = await readSettings(unit);
    const { oxfmt } = objectOf(resolved.sections.typescript);
    const ignored = Object.keys(objectOf(objectOf(oxfmt).ignore));

    return { ...style, ignorePatterns: [...(style.ignorePatterns ?? []), ...ignored] };
}
