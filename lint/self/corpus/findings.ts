import { resolve } from 'node:path';

import FINDINGS from '../../consumer/catalogue/findings.json' with { type: 'json' };
import plugin from '../../consumer/rules/plugin.js';
import { printedIds } from '../../engine/catalogue/printed-ids.js';

export function printedFindingIds(): string[] {
    return printedIds({
        checks: resolve(import.meta.dirname, '../../consumer/checks'),
        plugin,
        rows: FINDINGS,
    });
}

export { default as FAMILIES } from '../../consumer/catalogue/families.json' with { type: 'json' };
export { default as FINDINGS } from '../../consumer/catalogue/findings.json' with { type: 'json' };
