import type { OxfmtConfig } from 'oxfmt';

import { readSettings } from '../../../lint/index.rules.js';
import { objectOf } from '../../../lint/kit/project/json.js';
import style from './style.js';

export async function oxfmtConfigAt(unit: string): Promise<OxfmtConfig> {
    const { resolved } = await readSettings(unit);
    const { generated, oxfmt } = objectOf(resolved.sections.typescript);
    // invariant: a root a script writes is written byte for byte, and the formatter leaves it alone.
    const ignored = [
        ...Object.keys(objectOf(objectOf(oxfmt).ignore)),
        ...Object.keys(objectOf(generated)),
    ];

    return { ...style, ignorePatterns: [...(style.ignorePatterns ?? []), ...ignored] };
}
