import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { onlyPasses, passOf, SELECTING_BIN } from './check-passes.js';
import { temporaryDirectory } from './temporary-directory.js';

export const SIX_TARGETS = [
    '.PHONY: install build lint fix test check',
    '',
    'install:',
    '\tnpm ci',
    '',
    'build:',
    '\tnpm run build',
    '',
    'lint:',
    '\tnpm run lint',
    '',
    'fix:',
    '\tnpm run lint:fix',
    '',
    'test:',
    '\tnpm test',
    '',
    'check: lint test',
    '',
].join('\n');

export function projectWith({
    isRepository = true,
    makefile,
}: {
    isRepository?: boolean;
    makefile?: string;
}): string {
    const project = temporaryDirectory('spec-names-repository-');
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { main: 'index.ts', name: 'spec-names-repository', private: true, version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["**/*.ts"] }\n',
    );
    writeFileSync(
        join(project, 'index.ts'),
        'export function run(): string {\n  return "ran";\n}\n',
    );
    if (makefile !== undefined) {
        writeFileSync(join(project, 'Makefile'), makefile);
    }
    if (isRepository) {
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        execFileSync('git', ['add', '.'], { cwd: project });
    }

    return project;
}

export function namesPassOf(project: string): string {
    const result = spawnSync('bash', [SELECTING_BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project, onlyPasses('names')),
    });

    return passOf(result.stdout, 'Names (tree)');
}

// npm's INIT_CWD names the project the CLI answers for; a chain started under npm must name its own.
export function inProject(project: string, env: Record<string, string> = {}): NodeJS.ProcessEnv {
    return { ...process.env, ...env, INIT_CWD: project };
}
