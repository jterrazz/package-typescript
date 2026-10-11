import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { sandboxScriptSource } from '../sources.js';

const WIDE = 'export declare const kind: string;\n';

const EXACT = "export declare const kind: 'api';\n";

function laid(root: string, files: Readonly<Record<string, string>>): void {
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
}

describe('sources', () => {
    test('sandboxScriptSource — the suite runs against the instrumented build carrying the project’s own declarations', () => {
        // Given - a project built from its sources, and a sandbox whose build infers its declarations wider
        const project = mkdtempSync(join(tmpdir(), 'mutation-project-'));
        const sandbox = mkdtempSync(join(tmpdir(), 'mutation-sandbox-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
            rmSync(sandbox, { force: true, recursive: true });
        });
        laid(project, { 'dist/index.d.ts': EXACT, 'dist/index.js': 'original' });
        const build = `mkdir -p dist/nested && printf '${WIDE}' | tee dist/index.d.ts dist/nested/only.d.ts > /dev/null && printf instrumented > dist/index.js`;
        laid(sandbox, { 'package.json': JSON.stringify({ scripts: { build } }) });
        writeFileSync(join(sandbox, 'sandbox.mjs'), sandboxScriptSource(true, project));

        // When - the sandbox script runs
        execFileSync(process.execPath, ['sandbox.mjs'], { cwd: sandbox, stdio: 'ignore' });

        // Then - the project's declaration replaces the instrumented one, the code and a declaration only the sandbox holds stay
        expect(
            ['dist/index.d.ts', 'dist/index.js', 'dist/nested/only.d.ts'].map((path) =>
                readFileSync(join(sandbox, path), 'utf8'),
            ),
        ).toStrictEqual([EXACT, 'instrumented', WIDE]);
    });

    test('sandboxScriptSource — a run that builds nothing only lays the git tree', () => {
        // Given - a project whose suite builds nothing
        const script = sandboxScriptSource(false, '/project');

        // Then - no build, no declaration copied
        expect(script).toBe(
            "import { execFileSync } from 'node:child_process';\n\nexecFileSync('git', ['init', '--quiet']);\nexecFileSync('git', ['add', '--all']);\n",
        );
    });

    test('sandboxScriptSource — a member’s sandbox holds the repository’s top-level entries where its specs climb to', () => {
        // Given - a repository with a testdata/ folder and a member two folders down, and the sandbox of that member four folders below it
        const repository = mkdtempSync(join(tmpdir(), 'mutation-repository-'));
        onTestFinished(() => {
            rmSync(repository, { force: true, recursive: true });
        });
        const sandbox = join(repository, 'packages/server/.artifacts/stryker/tmp/sandbox-1');
        laid(repository, { 'testdata/golden.json': '{}', 'packages/server/package.json': '{}' });
        mkdirSync(sandbox, { recursive: true });
        writeFileSync(
            join(sandbox, 'sandbox.mjs'),
            sandboxScriptSource(false, join(repository, 'packages/server'), {
                levels: 2,
                names: ['testdata'],
                root: repository,
            }),
        );

        // When - the sandbox script runs
        execFileSync(process.execPath, ['sandbox.mjs'], { cwd: sandbox, stdio: 'ignore' });

        // Then - a spec of the copy that climbs two folders out of it reads the repository's file, at the place the real tree would have it
        expect(readFileSync(join(sandbox, '../../testdata/golden.json'), 'utf8')).toBe('{}');
    });

    test('sandboxScriptSource — no entry is laid for a project that is the repository, nor for a climb that leaves the sandbox’s own folders', () => {
        // Given - a root project (no folder to climb), and a member four folders down
        const root = sandboxScriptSource(false, '/project', {
            levels: 0,
            names: ['docs'],
            root: '/r',
        });
        const deep = sandboxScriptSource(false, '/project', {
            levels: 4,
            names: ['docs'],
            root: '/r',
        });

        // Then - the script only lays the git tree in both
        expect([root, deep]).toStrictEqual([
            sandboxScriptSource(false, '/project'),
            sandboxScriptSource(false, '/project'),
        ]);
    });
});
