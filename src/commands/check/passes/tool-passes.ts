import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import {
    keptAcross,
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
} from '../../../../lint/kit/baseline/oxlint-suppressions.js';
import { invariant, messageOf, refusal } from '../../../../lint/kit/catalogue/lesson.js';
import { isFileOnDisk } from '../../../../lint/kit/project/fs-cache.js';
import { astroChecked } from '../../../drivers/astro/astro.js';
import { knip } from '../../../drivers/knip/knip.js';
import { fixedUnder } from '../../../drivers/oxlint/oxlint.js';
import type { FixScope } from '../../../drivers/oxlint/unsafe-fixers.js';
import { astroFormatted } from '../../../drivers/prettier/prettier.js';
import { typeChecked } from '../../../drivers/tsc/tsc.js';
import type { Launched } from './launched.js';
import { oxfmt, oxlint } from './runners.js';
import type { Check } from './setup.js';

async function typescriptRuns(
    check: Check,
    units: readonly string[],
    log: string,
): Promise<number> {
    const parts = units.map((_, index) => check.logs.at(`type-${String(index)}.log`));
    const statuses = await Promise.all(
        units.map(
            async (unit, index) => await typeChecked(check.tools.tsc, unit, parts[index] ?? log),
        ),
    );
    writeFileSync(log, parts.map((part) => check.logs.read(part)).join(''));

    return statuses.some((status) => status !== 0) ? 1 : 0;
}

export function typescriptPass(check: Check): Launched | undefined {
    if (!check.selected('typescript')) {
        return undefined;
    }
    const log = check.logs.at('type.log');
    const units = check.declarations.get('.')?.kind === 'workspace' ? check.members : ['.'];

    return { log, status: typescriptRuns(check, units, log) };
}

export async function lintCheck(check: Check): Promise<number> {
    const log = check.logs.at('lint.log');
    writeFileSync(log, '');

    return await oxlint(check, ['--type-aware', '--deny-warnings', ...check.lintArgs], log);
}

async function pruned(check: Check): Promise<number> {
    if (!isFileOnDisk(OXLINT_SUPPRESSIONS)) {
        return 0;
    }

    const status = await oxlint(
        check,
        ['--type-aware', '--prune-suppressions', ...check.lintArgs],
        check.logs.at('prune.log'),
    );
    removeWhenEmpty('.');

    return status;
}

async function fixScopes(check: Check): Promise<FixScope[]> {
    const { own, path } = check.configs.oxlint;
    const { writeFixScopes } = await import('../../../drivers/oxlint/unsafe-fixers.js').catch(
        (error: unknown) => {
            throw invariant(`the unsafe-fixers module does not load: ${messageOf(error)}`);
        },
    );
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
        const fixed = await fixedUnder(
            check.tools.oxlint,
            wrapper,
            [...check.lintArgs, ...files],
            log,
        );
        status = fixed > COULD_NOT_RUN ? fixed : status;
        rmSync(wrapper, { force: true });
    }

    return status;
}

export async function lintFix(check: Check): Promise<number> {
    let scopes: FixScope[];
    try {
        scopes = await fixScopes(check);
    } catch (error) {
        writeFileSync(check.logs.at('fix-wrapper.log'), `${messageOf(error)}\n`);

        return 1;
    }
    const fixed = await keptAcross('.', async () => await fixedScopes(check, scopes));
    await pruned(check);
    const judged = await lintCheck(check);
    if (fixed !== 0) {
        appendFileSync(check.logs.at('lint.log'), readFileSync(check.logs.at('fix-scopes.log')));
    }

    return fixed === 0 ? judged : fixed;
}

export function formatCheck(check: Check): Launched | undefined {
    if (check.fix || !check.selected('oxfmt')) {
        return undefined;
    }
    const log = check.logs.at('format.log');

    return { log, status: oxfmt(check, ['--check'], log) };
}

export function knipPass(check: Check): Launched | undefined {
    if (check.fix || !check.selected('knip')) {
        return undefined;
    }
    const log = check.logs.at('knip.log');

    return {
        log,
        status: knip(check.tools.knip, { log, merged: check.logs.at('knip-merged.json') }),
    };
}

async function astroRun(check: Check, unit: string, log: string): Promise<number> {
    if (unit !== '.') {
        writeFileSync(log, `${unit}\n`);
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
    const units = ['.', ...check.members].filter(
        (unit) => check.declarations.get(unit)?.platform === 'astro',
    );
    if (!check.selected('astro') || units.length === 0) {
        return undefined;
    }
    const log = check.logs.at('astro.log');

    return { log, status: astroRuns(check, units, log) };
}
