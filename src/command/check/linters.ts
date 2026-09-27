import { appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { invariant, messageOf, refusal } from '../../../lint/engine/catalogue/lesson.js';
import { isFile } from '../disk.js';
import { mergedKnipConfig } from '../merge-knip-config.js';
import { run } from '../processes.js';
import { DEFAULT_OXLINT_CONFIG, FIX_WRAPPER } from '../tool-configs.js';
import { presetAt } from '../toolchain.js';
import type { FixScope } from '../unsafe-fixers.js';
import type { Launched } from './launched.js';
import { usesAstro } from './project.js';
import { oxfmt, oxlintJson } from './runners.js';
import { projectBinary } from './setup.js';
import type { Check } from './setup.js';

export function typescriptPass(check: Check): Launched | undefined {
    if (!check.selected('typescript')) {
        return undefined;
    }
    const log = check.logs.at('type.log');

    return {
        log,
        status: run(check.tools.tsc, ['--noEmit'], { stderr: 'stdout', stdout: { path: log } }),
    };
}

export async function lintReport(check: Check): Promise<number> {
    writeFileSync(check.logs.at('lint.log'), '');

    return await oxlintJson(check, ['--type-aware', '--deny-warnings', ...check.lintArgs], {
        report: check.logs.at('lint.json'),
        stderr: { path: check.logs.at('lint.err') },
    });
}

async function fixScopes(check: Check): Promise<FixScope[]> {
    const { own } = check.configs.oxlint;
    const { writeFixScopes } = await import('../unsafe-fixers.js').catch((error: unknown) => {
        throw invariant(`the unsafe-fixers module does not load: ${messageOf(error)}`);
    });
    try {
        return writeFixScopes({
            nested: own !== undefined,
            root: process.cwd(),
            rootConfig: own === undefined ? DEFAULT_OXLINT_CONFIG : join(process.cwd(), own),
            targets: check.lintTargets.paths,
        });
    } catch (error) {
        throw new Error(
            refusal({
                fix: 'make the directory beside the oxlint config writable, then run `typescript fix` again',
                found: `the fix wrapper could not be written: ${messageOf(error)}`,
                read: 'docs/06-quality-checks.md#a-wrapper-fix-mode-cannot-write',
                why: 'fix mode lints through a wrapper that turns the unsafe fixers off; without it no oxlint fix runs',
            }),
            { cause: error },
        );
    }
}

export async function lintFix(check: Check): Promise<number> {
    let scopes: FixScope[];
    try {
        scopes = await fixScopes(check);
    } catch (error) {
        appendFileSync(check.logs.at('lint.log'), `${messageOf(error)}\n`);

        return 1;
    }
    let status = 0;
    for (const { files, wrapper } of scopes) {
        // oxlint-disable-next-line no-await-in-loop -- each scope rewrites files the next one may lint
        const fixed = await run(
            check.tools.oxlint,
            [
                '--type-aware',
                '--fix',
                '-c',
                wrapper,
                '--ignore-pattern',
                FIX_WRAPPER,
                ...check.lintArgs,
                ...files,
            ],
            { stderr: 'stdout', stdout: { append: true, path: check.logs.at('lint.log') } },
        );
        status = fixed === 0 ? status : fixed;
        rmSync(wrapper, { force: true });
    }

    return status;
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
    const merged = check.logs.at('knip-merged.json');
    const log = check.logs.at('knip.log');
    const project = ['knip.jsonc', 'knip.json'].find((name) => isFile(name));
    try {
        const config = mergedKnipConfig(presetAt('src/presets/knip/config.json'), project);
        writeFileSync(merged, JSON.stringify(config));
    } catch (error) {
        writeFileSync(log, `${messageOf(error)}\n`);

        return { log, status: Promise.resolve(1) };
    }

    return {
        log,
        status: run(check.tools.knip, ['--no-progress', '--no-config-hints', '--config', merged], {
            stderr: 'stdout',
            stdout: { path: log },
        }),
    };
}

async function astroRun(check: Check, log: string): Promise<number> {
    const checked = await run(projectBinary('astro'), ['check'], {
        stderr: 'stdout',
        stdout: { path: log },
    });
    const formatted = await run(
        check.tools.prettier,
        [
            check.fix ? '--write' : '--check',
            '--config',
            presetAt('src/presets/prettier/astro.json'),
            '--plugin',
            check.tools.prettierAstroPlugin,
            '--no-error-on-unmatched-pattern',
            '**/*.astro',
        ],
        { stderr: 'stdout', stdout: { append: true, path: log } },
    );

    return checked === 0 && formatted === 0 ? 0 : 1;
}

export function astroPass(check: Check): Launched | undefined {
    if (!check.selected('astro') || !usesAstro('.')) {
        return undefined;
    }
    const log = check.logs.at('astro.log');

    return { log, status: astroRun(check, log) };
}
