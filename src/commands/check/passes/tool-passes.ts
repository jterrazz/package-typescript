import { rmSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import { readSettings } from '../../../../lint/index.rules.js';
import {
    keptAcross,
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
} from '../../../../lint/kit/baseline/oxlint-suppressions.js';
import { messageOf, refusal } from '../../../../lint/kit/catalogue/lesson.js';
import { buildPlanOf, conventionsOf } from '../../../../lint/kit/project/build-plan.js';
import { isFileOnDisk } from '../../../../lint/kit/project/fs-cache.js';
import { astroChecked, astroEntrypointsOf } from '../../../drivers/astro/astro.js';
import { knip } from '../../../drivers/knip/knip.js';
import type { KnipProject, KnipUnit } from '../../../drivers/knip/knip.js';
import {
    knipSettingsOf,
    withGoToolchain,
    withLoadedPackages,
} from '../../../drivers/knip/settings.js';
import { fixedUnder } from '../../../drivers/oxlint/oxlint.js';
import type { FixScope } from '../../../drivers/oxlint/unsafe-fixers.js';
import { astroFormatted } from '../../../drivers/prettier/prettier.js';
import { typeChecked } from '../../../drivers/tsc/tsc.js';
import {
    astroSyncedOnce,
    isAstro,
    lintTypesGenerated,
    typedUnits,
    typesGenerated,
} from './generated-types.js';
import type { Launched } from './launched.js';
import { fixReportCarried, lintOutcome } from './lint-outcome.js';
import { oxfmt, oxlint } from './runners.js';
import type { Check } from './setup.js';

async function typeCheckedUnit(check: Check, unit: string, log: string): Promise<number> {
    if ((await typesGenerated(check, unit, log)) !== 0) {
        return 1;
    }

    return await typeChecked(check.tools.tsc, unit, log);
}

async function typescriptRuns(
    check: Check,
    units: readonly string[],
    log: string,
): Promise<number> {
    const parts = units.map((_, index) => check.logs.at(`type-${String(index)}.log`));
    const statuses = await Promise.all(
        units.map(async (unit, index) => await typeCheckedUnit(check, unit, parts[index] ?? log)),
    );
    writeFileSync(log, parts.map((part) => check.logs.read(part)).join(''));

    return statuses.some((status) => status !== 0) ? 1 : 0;
}

export function typescriptPass(check: Check): Launched | undefined {
    if (!check.selected('typescript')) {
        return undefined;
    }
    const log = check.logs.at('type.log');

    return { log, status: typescriptRuns(check, typedUnits(check), log) };
}

export async function lintCheck(check: Check): Promise<number> {
    const log = check.logs.at('lint.log');
    writeFileSync(log, '');
    if ((await lintTypesGenerated(check, log)) !== 0) {
        return 1;
    }

    return await oxlint(check, ['--type-aware', '--deny-warnings'], log);
}

async function pruned(check: Check): Promise<number> {
    if (!isFileOnDisk(OXLINT_SUPPRESSIONS)) {
        return 0;
    }

    const status = await oxlint(
        check,
        ['--type-aware', '--prune-suppressions'],
        check.logs.at('prune.log'),
    );
    removeWhenEmpty('.');

    return status;
}

async function fixScopes(check: Check): Promise<FixScope[]> {
    const { own, path } = check.configs.oxlint;
    // hazard: loaded on a fix only: the rulebook it reads resolves every lint plugin as it loads, which no other command needs installed.
    const { writeFixScopes } = await import('../../../drivers/oxlint/unsafe-fixers.js');
    try {
        return writeFixScopes({
            nested: own !== undefined,
            root: process.cwd(),
            rootConfig: path,
            targets: check.lintTargets.paths,
        });
    } catch (error) {
        throw new Error(
            refusal({
                fix: 'make the directory beside the oxlint config writable, then run `typescript fix` again',
                found: `the fix wrapper could not be written: ${messageOf(error)}`,
                read: 'docs/reference/quality-checks.md#a-wrapper-fix-mode-cannot-write',
                why: 'fix mode lints through a wrapper that turns the unsafe fixers off; without it no oxlint fix runs',
            }),
            { cause: error },
        );
    }
}

const COULD_NOT_RUN = 1;

async function fixedScopes(check: Check, scopes: readonly FixScope[]): Promise<number> {
    const log = check.logs.at('fix-scopes.log');
    let status = 0;
    for (const { files, wrapper } of scopes) {
        const fixed = await fixedUnder(check.tools.oxlint, wrapper, files, log);
        status = fixed > COULD_NOT_RUN ? fixed : status;
        rmSync(wrapper, { force: true });
    }

    return status;
}

export type Fixed = { judged: boolean; status: number };

/** Applies the lint fixes; judging what is left waits until the formatter has laid the code out. */
export async function lintFix(check: Check): Promise<Fixed> {
    let scopes: FixScope[];
    try {
        scopes = await fixScopes(check);
    } catch (error) {
        writeFileSync(check.logs.at('fix-wrapper.log'), `${messageOf(error)}\n`);

        return { judged: true, status: 1 };
    }
    // Stryker disable next-line StringLiteral: the root and an empty name resolve to the working directory alike
    const status = await keptAcross('.', async () => await fixedScopes(check, scopes));
    await pruned(check);

    return { judged: false, status };
}

// invariant: a size cap is measured on the layout the formatter writes: a line the formatter breaks in three counts as three.
export async function lintJudged(check: Check, { judged, status }: Fixed): Promise<number> {
    if (judged) {
        return status;
    }
    const remaining = await lintCheck(check);
    // Stryker disable next-line CallExpression: what the call writes is proven in fixReportCarried, and a spec reaches this line only through a fix scope that fails
    fixReportCarried(check, status);

    return lintOutcome(status, remaining);
}

export function formatCheck(check: Check): Launched | undefined {
    if (check.fix || !check.selected('oxfmt')) {
        return undefined;
    }
    const log = check.logs.at('format.log');

    return { log, status: oxfmt(check, ['--check'], log) };
}

// invariant: a unit hands knip its build's entries, the paths its presets load by name, and its settings'.
async function knipUnit(unit: string): Promise<KnipUnit> {
    const { resolved } = await readSettings(unit);
    const { declaration } = resolved;
    const steps = buildPlanOf(unit, { declaration, settings: conventionsOf(unit).settings });

    // Stryker disable next-line ArrayDeclaration: knip skips an entry that names no file, so a seeded one changes nothing
    const loaded: string[] = [];
    for (const { entries, name } of resolved.presets) {
        if (entries !== undefined) {
            loaded.push(...entries(resolved.sections[name] ?? {}, unit));
        }
    }

    // Stryker disable next-line ArrayDeclaration: a stand-in package name is one no manifest holds, which knip reads as an ignored dependency nothing declares
    const packages = resolved.presets.flatMap(({ loadedPackages }) => loadedPackages?.(unit) ?? []);

    return {
        entries: [
            ...steps.flatMap(({ entry }) => Object.values(entry)),
            ...loaded,
            ...astroEntrypointsOf(unit),
        ],
        settings: withLoadedPackages(
            withGoToolchain(unit, knipSettingsOf(resolved.sections.typescript)),
            packages,
        ),
    };
}

// hazard: a flat config would apply each member's own entries and ignores to the root alone.
async function knipProject(check: Check): Promise<KnipProject> {
    const root = await knipUnit('.');
    const units = await Promise.all(
        check.members.map(async (member) => [member, await knipUnit(member)] as const),
    );

    return { ...root, members: Object.fromEntries(units) };
}

async function knipRun(check: Check, log: string): Promise<number> {
    let project: KnipProject;
    try {
        project = await knipProject(check);
    } catch (error) {
        writeFileSync(log, `${messageOf(error)}\n`);

        return 1;
    }

    return await knip(check.tools.knip, project, {
        log,
        merged: check.logs.at('knip-merged.json'),
    });
}

export function knipPass(check: Check): Launched | undefined {
    if (check.fix || !check.selected('knip')) {
        return undefined;
    }
    const log = check.logs.at('knip.log');

    return { log, status: knipRun(check, log) };
}

async function astroRun(check: Check, unit: string, log: string): Promise<number> {
    if (unit !== '.') {
        writeFileSync(log, `${unit}\n`);
    }
    if ((await astroSyncedOnce(check, unit, log)) !== 0) {
        return 1;
    }
    const checked = await astroChecked(unit, log);
    const formatted = await astroFormatted(
        { binary: check.tools.prettier, plugin: check.tools.prettierAstroPlugin },
        { fix: check.fix, log, unit },
    );

    return checked === 0 && formatted === 0 ? 0 : 1;
}

async function astroRuns(check: Check, units: readonly string[], log: string): Promise<number> {
    const parts = units.map((_, index) => check.logs.at(`astro-${String(index)}.log`));
    const statuses = await Promise.all(
        units.map(async (unit, index) => await astroRun(check, unit, parts[index] ?? log)),
    );
    writeFileSync(log, parts.map((part) => check.logs.read(part)).join('\n'));

    return statuses.some((status) => status !== 0) ? 1 : 0;
}

export function astroPass(check: Check): Launched | undefined {
    const units = ['.', ...check.members].filter((unit) => isAstro(check, unit));
    if (!check.selected('astro') || units.length === 0) {
        return undefined;
    }
    const log = check.logs.at('astro.log');

    return { log, status: astroRuns(check, units, log) };
}
