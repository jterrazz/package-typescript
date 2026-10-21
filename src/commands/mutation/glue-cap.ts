import { mutantsMade } from '../../drivers/stryker/enumerate.js';
import { heldIn } from '../../drivers/stryker/mutate-entries.js';
import { IGNORERS_FILE } from '../../drivers/stryker/stryker.js';
import type { Measured } from '../../drivers/stryker/stryker.js';
import { capped, cappedEntries, cappedReport } from './cap.js';
import type { Capped } from './cap.js';
import { isGlue } from './roles.js';
import type { GlueBar, GlueCapped } from './roles.js';
import { fileOfRange } from './scope.js';

type Stages = { modules: string[]; reached: string[] };

/** Both stages' entries once the cap holds: the glue mutants the change makes on the lines it reaches, enumerated before any run, past the cap a stable sample of them; domain is never capped. */
export async function glueCapped(
    project: string,
    stages: Stages,
    glue: GlueBar,
): Promise<Stages & { capped: Capped | undefined }> {
    const entries = [...stages.modules, ...stages.reached];
    const files = [...new Set(entries.map((entry) => fileOfRange(entry)))].filter((file) =>
        isGlue(file, glue),
    );
    const all = await mutantsMade(project, files, IGNORERS_FILE);
    const made = all.filter((mutant) =>
        heldIn(entries, mutant.file, {
            end: { column: mutant.endColumn, line: mutant.endLine },
            start: { column: mutant.column, line: mutant.line },
        }),
    );
    const cap = capped(made, glue.cap);
    if (cap === undefined) {
        return { ...stages, capped: undefined };
    }

    return {
        capped: cap,
        modules: cappedEntries(stages.modules, cap, fileOfRange),
        reached: cappedEntries(stages.reached, cap, fileOfRange),
    };
}

export const capHeld = (
    outcome: Measured | { status: number },
    cap: Capped | undefined,
): Measured | { status: number } =>
    cap === undefined || !('report' in outcome)
        ? outcome
        : { ...outcome, report: cappedReport(outcome.report, cap) };

export const glueOf = (glue: GlueBar, cap: Capped | undefined): GlueBar => {
    if (cap === undefined) {
        return glue;
    }
    const held: GlueCapped = { measured: cap.measured.length, of: cap.of };

    return { ...glue, capped: held };
};
