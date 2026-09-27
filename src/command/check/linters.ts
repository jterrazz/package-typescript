import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { mergedKnipConfig } from '../merge-knip-config.js';
import { run } from '../processes.js';
import { DEFAULT_OXLINT_CONFIG, FIX_WRAPPER, isFile } from '../tool-configs.js';
import { presetAt } from '../toolchain.js';
import type { Launched } from './launched.js';
import { usesAstro } from './project.js';
import { oxfmt, oxlint } from './runners.js';
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

    return await oxlint(
        check,
        ['--type-aware', '--deny-warnings', '--format', 'json', ...check.lintArgs],
        {
            stderr: { path: check.logs.at('lint.err') },
            stdout: { path: check.logs.at('lint.json') },
        },
    );
}

async function fixScopes(check: Check): Promise<{ files: string[]; wrapper: string }[]> {
    const { own } = check.configs.oxlint;
    try {
        const { writeFixScopes } = await import('../unsafe-fixers.js');

        return writeFixScopes({
            nested: own !== undefined,
            root: process.cwd(),
            rootConfig: own === undefined ? DEFAULT_OXLINT_CONFIG : join(process.cwd(), own),
            targets: check.lintTargets.paths,
        });
    } catch {
        return [];
    }
}

export async function lintFix(check: Check): Promise<number> {
    const scopes = await fixScopes(check);
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
    const project = ['knip.jsonc', 'knip.json'].find((name) => isFile(name));
    try {
        const config = mergedKnipConfig(presetAt('src/presets/knip/config.json'), project);
        writeFileSync(merged, JSON.stringify(config));
    } catch (error) {
        writeFileSync(merged, '');
        process.stderr.write(
            `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
        );
    }
    const log = check.logs.at('knip.log');

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
