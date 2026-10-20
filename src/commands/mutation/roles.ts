import { matchesGlob } from 'node:path';

import type { Judged, Survivor } from './survivors.js';

/** What makes a source glue, and the share of its mutants a test runs that must be detected; every other source is domain, held to zero survivors. */
export type GlueBar = { bar: number; globs: readonly string[] };

/** What glue held of the run: the glue mutants a test ran, those detected, its survivors, and whether the detected share reaches the bar. */
export type GlueHeld = {
    bar: number;
    detected: number;
    holds: boolean;
    judged: number;
    survivors: Survivor[];
};

export const isGlue = (file: string, { globs }: GlueBar): boolean =>
    globs.some((glob) => matchesGlob(file, glob));

const PERCENT = 100;

/** The run's survivors split by what their source is: domain's fail the run, glue's only when the share of glue mutants detected falls under the bar. */
export function byRole(
    { detectedByFile, survivors }: Pick<Judged, 'detectedByFile' | 'survivors'>,
    glue: GlueBar,
): { domain: Survivor[]; glue: GlueHeld } {
    const glued = survivors.filter(({ file }) => isGlue(file, glue));
    const detected = Object.entries(detectedByFile)
        .filter(([file]) => isGlue(file, glue))
        .reduce((sum, [, count]) => sum + count, 0);
    const judged = detected + glued.length;

    return {
        domain: survivors.filter(({ file }) => !isGlue(file, glue)),
        glue: {
            bar: glue.bar,
            detected,
            holds: detected * PERCENT >= Math.round(glue.bar * PERCENT) * judged,
            judged,
            survivors: glued,
        },
    };
}
