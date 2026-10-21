import { appendFileSync } from 'node:fs';

import { astroSynced } from '../../../drivers/astro/astro.js';
import { routeTypesGenerated } from './route-types.js';
import type { Check } from './setup.js';

type Generated = { log: string; status: number };

type Generator = (unit: string, log: string) => Promise<number>;

const generations = new WeakMap<Check, Map<Generator, Map<string, Promise<Generated>>>>();

const generatedInto = async (
    generate: Generator,
    unit: string,
    log: string,
): Promise<Generated> => ({ log, status: await generate(unit, log) });

function runsOf(check: Check, generate: Generator): Map<string, Promise<Generated>> {
    const byGenerator =
        generations.get(check) ?? new Map<Generator, Map<string, Promise<Generated>>>();
    generations.set(check, byGenerator);
    const runs = byGenerator.get(generate) ?? new Map<string, Promise<Generated>>();
    byGenerator.set(generate, runs);

    return runs;
}

// invariant: a generator writes the types a fresh clone lacks, which the TypeScript Check, the type-aware lint and the Astro pass all read, so it runs once per unit and run, before any of them reads; each pass it fails prints its report.
async function generatedOnce(
    check: Check,
    generate: Generator,
    unit: string,
    log: string,
): Promise<number> {
    const runs = runsOf(check, generate);
    const generated =
        runs.get(unit) ??
        generatedInto(generate, unit, check.logs.at(`${generate.name}-${String(runs.size)}.log`));
    runs.set(unit, generated);
    const { log: report, status } = await generated;
    if (status !== 0) {
        appendFileSync(log, check.logs.read(report));
    }

    return status;
}

export const isAstro = (check: Check, unit: string): boolean =>
    check.declarations.get(unit)?.platform === 'astro';

export const astroSyncedOnce = async (check: Check, unit: string, log: string): Promise<number> =>
    await generatedOnce(check, astroSynced, unit, log);

export async function typesGenerated(check: Check, unit: string, log: string): Promise<number> {
    if (isAstro(check, unit) && (await astroSyncedOnce(check, unit, log)) !== 0) {
        return 1;
    }

    return await generatedOnce(check, routeTypesGenerated, unit, log);
}

export const typedUnits = (check: Check): readonly string[] =>
    check.members.length > 0 ? check.members : ['.'];

// invariant: the type-aware rules resolve types as the compiler does, so the lint waits for the generated ones; a rule reading a type a fresh clone lacks would judge it `error`.
export async function lintTypesGenerated(check: Check, log: string): Promise<number> {
    for (const unit of typedUnits(check)) {
        if ((await typesGenerated(check, unit, log)) !== 0) {
            return 1;
        }
    }

    return 0;
}
