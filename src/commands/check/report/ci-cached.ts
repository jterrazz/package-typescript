import { isJsonObject } from '../../../../lint/kit/project/json.js';
import { print } from '../../terminal.js';
import { ciConcluded, ciPlaceOf, passLineOf, passNameOf } from './ci-report.js';
import type { CiRow } from './ci-report.js';

/** When a proof was taken, short: its UTC time, and its date too when it is not today's. */
export function shortTimeOf(at: string, now: Date): string {
    const [day, time = ''] = new Date(at).toISOString().split('T');
    const minutes = `${time.slice(0, 5)} UTC`;

    return day === now.toISOString().split('T')[0] ? minutes : `${String(day)} ${minutes}`;
}

/** What a pass answered from a proof shows in place of its seconds: `cached · 22:16 UTC · run 40778644382`. */
export const cachedTimeOf = (at: string, run: null | string, now: Date): string =>
    `cached · ${shortTimeOf(at, now)}${run === null ? '' : ` · run ${run}`}`;

const STAGE_NAMES: Readonly<Record<string, string>> = { test: 'tests' };

/** What a proof tells CI: when it was taken, by which run, for which stage, and the passes its verdict names. */
export type CachedProof = { at: string; passes: unknown; run: null | string; stage: string };

/** The rows of a stage answered from its proof: each pass its verdict names, or the stage alone, every one cached. */

export function cachedRowsOf({ at, passes, run, stage }: CachedProof, now: Date): CiRow[] {
    const labels = Array.isArray(passes)
        ? passes.flatMap((pass: unknown) =>
              isJsonObject(pass) && typeof pass.label === 'string' ? [pass.label] : [],
          )
        : [];
    const names =
        labels.length === 0
            ? [STAGE_NAMES[stage] ?? stage]
            : labels.map((label) => passNameOf(label));

    return names.map((name) => ({
        findings: [],
        name,
        status: 0,
        time: cachedTimeOf(at, run, now),
    }));
}

/** A hit on CI: a cached line for every pass the proof holds, then the run's end as any other. */
export function ciCachedPrinted(
    proof: CachedProof,
    project: string,
    environment: NodeJS.ProcessEnv,
    now = new Date(),
): void {
    const rows = cachedRowsOf(proof, now);
    print(`▸ typescript ${proof.stage}, proven green\n`);
    print(rows.map((row) => `${passLineOf(row)}\n`).join(''));
    ciConcluded(proof.stage, rows, ciPlaceOf(project, environment));
}
