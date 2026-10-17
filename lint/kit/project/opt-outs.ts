import { isJsonObject } from './json.js';

export type OptOut = { law: string; reason: string };

export function optOutsOf(
    declared: unknown,
    laws: ReadonlySet<string>,
): { optOuts: OptOut[]; problem: null | string } {
    if (declared === undefined) {
        return { optOuts: [], problem: null };
    }
    if (!isJsonObject(declared)) {
        return {
            optOuts: [],
            problem: 'holds an `optOuts` that is not an object mapping each law to its reason',
        };
    }
    const optOuts: OptOut[] = [];
    for (const [law, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            return {
                optOuts: [],
                problem: `opts out of \`${law}\` with no reason; say why the repository sets the law aside`,
            };
        }
        if (!laws.has(law)) {
            return {
                optOuts: [],
                problem: `opts out of \`${law}\`, which no preset declares; name a law as \`<preset>/<name>\``,
            };
        }
        optOuts.push({ law, reason });
    }

    return { optOuts, problem: null };
}
