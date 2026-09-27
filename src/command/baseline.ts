import { join } from 'node:path';
import process from 'node:process';

import {
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
} from '../../lint/engine/baseline/oxlint-suppressions.js';
import { ignorePatternsOf } from '../../lint/engine/project/project-files.js';
import { checker } from './checker.js';
import { lintTargets } from './lint-targets.js';
import { run } from './processes.js';
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

async function recordLinter(args: readonly string[], projectBin: string): Promise<void> {
    const { oxlint } = toolConfigs();
    const targets = await listedTargets(oxlint.ignoresOf, args);
    if (targets === null || targets.length === 0) {
        return;
    }
    for (const recording of ['--suppress-all', '--prune-suppressions']) {
        // oxlint-disable-next-line no-await-in-loop -- the prune reads the file the record wrote
        await run(
            binaryIn('oxlint', projectBin),
            [...oxlint.args, '--type-aware', recording, ...args, ...(targets ?? [])],
            { stderr: 'ignore', stdout: 'ignore' },
        );
    }
    removeWhenEmpty('.');
}

async function recordPass(pass: string, report: string, args: readonly string[]): Promise<void> {
    await checker(
        pass,
        ['.', '--format', 'json', ...args],
        { path: report },
        { stderr: 'ignore', typeless: pass !== 'comments' },
    );
}

export async function baseline(args: readonly string[]): Promise<number> {
    const project = projectRoot();
    process.chdir(project);
    const projectBin = join(project, 'node_modules/.bin');
    withTsgolintOnPath(projectBin);

    return await inScratch(async (scratch) => {
        const reports = {
            architecture: join(scratch, 'architecture.json'),
            comments: join(scratch, 'comments.json'),
            names: join(scratch, 'names.json'),
        };
        print(`${badge('TYPESCRIPT')} Recording the baseline...\n\n`);
        await recordLinter(args, projectBin);
        await recordPass('architecture', reports.architecture, [
            '--depcruise',
            binaryIn('depcruise', HOISTED_BESIDE_PACKAGE),
            ...args,
        ]);
        await recordPass('names', reports.names, [
            '--ls-lint',
            binaryIn('ls-lint', HOISTED_BESIDE_PACKAGE),
            ...args,
        ]);
        await recordPass('comments', reports.comments, args);
        const written = await checker(
            'baseline',
            [
                '.',
                '--architecture',
                reports.architecture,
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
            [
                ...toolConfigs().oxfmt.args,
                '--no-error-on-unmatched-pattern',
                'jterrazz.baseline.json',
                OXLINT_SUPPRESSIONS,
            ],
            {
                stderr: 'ignore',
                stdout: 'ignore',
            },
        );

        return 0;
    });
}
