import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');

const INSTALLED_BIN = join(ROOT, 'node_modules/@jterrazz/typescript/dist/typescript.js');

const EXAMPLE_FENCE = /```(?:ts|tsx|typescript)\n(?<code>[\s\S]*?)```/gu;

const NAMED_FILE = /^\/\/ (?<name>[\w./-]+\.tsx?)\n/u;

const SETTINGS_IMPORT = "from './jterrazz.config.ts'";

const DEFAULT_SETTINGS = `import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({});
`;

const SECTIONS = ['start', 'guides', 'concepts', 'reference'];

function pages(): string[] {
    const manual = SECTIONS.flatMap((section) =>
        readdirSync(join(ROOT, 'docs', section))
            .filter((name) => name.endsWith('.md'))
            .map((name) => join('docs', section, name)),
    );

    return ['README.md', 'skills/jterrazz-typescript/SKILL.md', 'docs/README.md', ...manual];
}

type Example = { code: string; file: string; page: string };

function examplesOf(page: string): Example[] {
    const text = readFileSync(join(ROOT, page), 'utf8');

    return [...text.matchAll(EXAMPLE_FENCE)].map((match) => {
        const code = match.groups?.code ?? '';
        return { code, file: NAMED_FILE.exec(code)?.groups?.name ?? 'example.ts', page };
    });
}

function layOut(project: string, examples: Example[]): void {
    for (const [index, { code, file, page }] of examples.entries()) {
        const folder = join(project, `${basename(page, '.md')}-${index}`);
        const path = join(folder, file);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, code);
        if (code.includes(SETTINGS_IMPORT) && file !== 'jterrazz.config.ts') {
            writeFileSync(join(dirname(path), 'jterrazz.config.ts'), DEFAULT_SETTINGS);
        }
    }
    writeFileSync(
        join(project, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: { incremental: false },
            extends: '@jterrazz/typescript/tsconfig/node',
        }),
    );
}

describe('documented-examples', () => {
    test('documented examples — every TypeScript example of the README, the manual and the skill compiles against the installed package', () => {
        // Given - each example in a folder of its own, under the file name its first line gives
        const examples = pages().flatMap((page) => examplesOf(page));
        expect(examples.length).toBeGreaterThan(10);
        mkdirSync(join(ROOT, '.artifacts'), { recursive: true });
        const project = mkdtempSync(join(ROOT, '.artifacts/documented-examples-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        layOut(project, examples);

        // When - the compiler the package ships checks them as a consumer's project
        const run = spawnSync(process.execPath, [INSTALLED_BIN, 'tsc', '--project', project], {
            encoding: 'utf8',
        });

        // Then - nothing is reported
        expect(`${run.stdout}${run.stderr}`).toBe('');
        expect(run.status).toBe(0);
    }, 60_000);
});
