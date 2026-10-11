import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import type { Measured } from '../../drivers/stryker/stryker.js';

export function buildsOf(project: string): boolean {
    try {
        const { scripts } = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return objectOf(scripts).build !== undefined;
    } catch {
        return false;
    }
}

export const NOTHING_MEASURED: Measured = { ranByTests: new Set(), report: undefined };

// invariant: a stage that measured nothing says nothing next; a failed one says Stryker's status.
export async function afterStage(
    outcome: Measured | undefined | { status: number },
    next: (measured: Measured) => number | Promise<number>,
): Promise<number> {
    if (outcome !== undefined && 'status' in outcome) {
        return outcome.status;
    }

    return await next(outcome ?? NOTHING_MEASURED);
}
