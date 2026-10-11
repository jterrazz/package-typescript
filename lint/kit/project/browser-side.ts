import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from './build-plan.js';
import { isJsonObject, objectOf } from './json.js';

// outside: a component, an island or a template runs in the browser, where the mutation run starts no project: no test of it is credited with a mutant there.
const BROWSER_SIDE = /\.(?:astro|jsx|svelte|tsx|vue)$/u;

/** Whether a source runs in the browser, where a mutation run credits no test with a mutant. */
export const isBrowserSide = (file: string): boolean => BROWSER_SIDE.test(file);

/** The mutants of browser-side sources that no test ran, in the last module report of the unit; `null` when the unit holds none (no run yet, or one that wrote none). */
export function unmeasuredBrowserMutants(unit: string): null | number {
    try {
        // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
        const text = readFileSync(join(unit, MUTATION_OUTPUT, 'report.json'), 'utf8');
        const report: unknown = JSON.parse(text);
        let count = 0;
        for (const [file, entry] of Object.entries(objectOf(objectOf(report).files))) {
            const { mutants } = objectOf(entry);
            if (isBrowserSide(file) && Array.isArray(mutants)) {
                count += mutants.filter(
                    (mutant) => isJsonObject(mutant) && mutant.status === 'NoCoverage',
                ).length;
            }
        }

        return count;
    } catch {
        return null;
    }
}
