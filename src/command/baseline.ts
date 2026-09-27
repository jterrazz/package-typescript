import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { ignorePatternsOf } from '../../lint/engine/project/project-files.js';
import { checker } from './checker.js';
import { lintTargets } from './lint-targets.js';
import { run } from './processes.js';
import { EMPTY_REPORT } from './report/diagnostic.js';
import { inScratch } from './scratch.js';
import { badge, print } from './terminal.js';
import { toolConfigs } from './tool-configs.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE, projectRoot, withTsgolintOnPath } from './toolchain.js';

async function listedTargets(
    ignoresOf: string | undefined,
    args: readonly string[],
): Promise<null | string[]> {
    try {
        return await lintTargets('.', { ignorePatterns: ignorePatternsOf(args), ignoresOf });
    } catch {
        return null;
    }
}

async function recordLinter(
    report: string,
    args: readonly string[],
    projectBin: string,
): Promise<void> {
    const { oxlint } = toolConfigs();
    const targets = await listedTargets(oxlint.ignoresOf, args);
    if (targets?.length === 0) {
        writeFileSync(report, EMPTY_REPORT);

        return;
    }
    await run(
        binaryIn('oxlint', projectBin),
        [...oxlint.args, '--type-aware', '--format', 'json', ...args, ...(targets ?? [])],
        { stderr: 'ignore', stdout: { path: report } },
    );
}

async function recordPass(pass: string, report: string, args: readonly string[]): Promise<void> {
    await checker(
        pass,
        ['.', '--format', 'json', ...args],
        { path: report },
        { stderr: 'ignore', typeless: pass === 'names' },
    );
}

export async function baseline(args: readonly string[]): Promise<number> {
    const project = projectRoot();
    process.chdir(project);
    const projectBin = join(project, 'node_modules/.bin');
    withTsgolintOnPath(projectBin);

    return await inScratch(async (scratch) => {
        const reports = {
            comments: join(scratch, 'comments.json'),
            lint: join(scratch, 'lint.json'),
            names: join(scratch, 'names.json'),
        };
        print(`${badge('TYPESCRIPT')} Recording the oxlint baseline...\n\n`);
        await recordLinter(reports.lint, args, projectBin);
        await recordPass('names', reports.names, [
            '--ls-lint',
            binaryIn('ls-lint', HOISTED_BESIDE_PACKAGE),
            ...args,
        ]);
        await recordPass('comments', reports.comments, args);
        const written = await checker(
            'baseline',
            [
                reports.lint,
                '.',
                '--names',
                reports.names,
                '--comments',
                reports.comments,
                '--write',
            ],
            'inherit',
            { stderr: 'inherit' },
        );
        if (written !== 0) {
            return 1;
        }
        await run(
            binaryIn('oxfmt', projectBin),
            [...toolConfigs().oxfmt.args, 'jterrazz.baseline.json'],
            {
                stderr: 'ignore',
                stdout: 'ignore',
            },
        );

        return 0;
    });
}
