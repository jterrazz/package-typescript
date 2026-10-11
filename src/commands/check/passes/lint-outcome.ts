import { appendFileSync, readFileSync } from 'node:fs';

import type { Check } from './setup.js';

/** A fix that failed leaves its own report, which the lint log carries on so the failure is read where the findings are. */
export function fixReportCarried(check: { logs: Pick<Check['logs'], 'at'> }, status: number): void {
    if (status !== 0) {
        appendFileSync(check.logs.at('lint.log'), readFileSync(check.logs.at('fix-scopes.log')));
    }
}

/** The status of a fix and the lint that judged what it left: the fix's failure wins, else the lint's. */
export const lintOutcome = (fixed: number, remaining: number): number =>
    fixed === 0 ? remaining : fixed;
