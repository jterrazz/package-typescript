import { existsSync, readFileSync } from 'node:fs';

import {
    BASELINE,
    labelOf,
    readBaseline,
    sectionOf,
    writeSection,
} from '../../lint/kit/baseline/baseline-file.js';
import { judgeFloor, raisedFloor } from '../../lint/kit/baseline/section.js';
import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { isList, objectOf, parsedObject } from '../../lint/kit/project/json.js';

const SCORE = 'score';

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);

const UNDETECTED: ReadonlySet<unknown> = new Set(['NoCoverage', 'Survived']);

export function scoreRoundedDownOf(report: unknown): null | number {
    const statuses = Object.values(objectOf(objectOf(report).files)).flatMap((file) => {
        const { mutants } = objectOf(file);

        return isList(mutants) ? mutants.map((mutant) => objectOf(mutant).status) : [];
    });
    const detected = statuses.filter((status) => DETECTED.has(status)).length;
    const valid = detected + statuses.filter((status) => UNDETECTED.has(status)).length;

    return valid === 0 ? null : Math.floor((detected / valid) * 10_000) / 100;
}

type Held = { lines: string[]; status: number };

export async function heldScore(root: string, report: string): Promise<Held> {
    const score = existsSync(report)
        ? scoreRoundedDownOf(parsedObject(readFileSync(report, 'utf8')))
        : null;
    if (score === null) {
        return { lines: [], status: 0 };
    }
    const { MUTATION_SECTION } = await import('../../lint/index.rulebook.js');
    const { problem } = readBaseline(root);
    if (problem !== null) {
        return {
            lines: [
                refusal({
                    fix: `correct ${BASELINE} until it is one JSON object of sections, or delete it, then run again`,
                    found: `${BASELINE} ${problem}`,
                    read: 'docs/07-quality-checks.md#the-mutation-floor',
                    why: 'the floor is read from that file and written beside the other sections, which a file that cannot be read as sections would lose',
                }),
            ],
            status: 1,
        };
    }
    const floor = sectionOf(root, MUTATION_SECTION) ?? {};
    const now = { [SCORE]: score };
    const broken = judgeFloor(now, floor);
    if (broken.length > 0) {
        return {
            lines: broken.map(({ teaching }) =>
                refusal({ ...teaching, read: 'docs/07-quality-checks.md#the-mutation-floor' }),
            ),
            status: 1,
        };
    }
    const held = floor[SCORE];
    const label = `${labelOf(MUTATION_SECTION)} › ${SCORE}`;
    if (held === score) {
        return { lines: [`${label} ${score.toFixed(2)}, at its floor`], status: 0 };
    }
    writeSection(root, MUTATION_SECTION, raisedFloor(now, floor));

    return {
        lines: [
            `${label} ${held === undefined ? 'recorded at' : `${held.toFixed(2)} →`} ${score.toFixed(2)}`,
        ],
        status: 0,
    };
}
