import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { reportWithUnmeasured } from '../../../lint/kit/project/browser-side.js';
import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import type { Measured } from '../../drivers/stryker/stryker.js';

export function buildsOf(project: string): boolean {
    try {
        // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
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

// invariant: a `client:only` component is loaded by the server and rendered by none, so what no test judged there is unmeasured, never a survivor; a failed stage has no report to read.
export function withClientOnlyUnmeasured(
    outcome: Measured | { status: number },
    sources: ReadonlySet<string>,
): Measured | { status: number } {
    return 'report' in outcome
        ? { ...outcome, report: reportWithUnmeasured(outcome.report, sources) }
        : outcome;
}
