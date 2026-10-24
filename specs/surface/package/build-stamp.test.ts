import { execFileSync } from 'node:child_process';
import {
    appendFileSync,
    chmodSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');

// outside: npm stands in for the build and the pack, each run logged outside the tree, since a log the tree held would be an input of the next key.
const NPM = `#!/bin/sh
case "$1" in
    run) mkdir -p dist && echo 'process.exit(0)' > dist/typescript.js && echo build >> "$NPM_LOG" ;;
    pack) mkdir -p "$STAGE/package/dist" && cp dist/typescript.js "$STAGE/package/dist/" && tar -czf "$5/package.tgz" -C "$STAGE" package && echo pack >> "$NPM_LOG" ;;
esac
`;

type Repository = { make: (target: string) => string[]; root: string };

function repository(): Repository {
    const root = mkdtempSync(join(tmpdir(), 'build-stamp-'));
    const outside = mkdtempSync(join(tmpdir(), 'build-stamp-npm-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
        rmSync(outside, { force: true, recursive: true });
    });
    const files = {
        '.gitignore': 'node_modules/\ndist/\n.artifacts/\n',
        'docs/README.md': '# Docs\n',
        'node_modules/.package-lock.json': '{}\n',
        'package-lock.json': '{}\n',
        'package.json': '{}\n',
        'specs/a.spec.ts': 'spec\n',
        'src/a.ts': 'export const A = 1;\n',
    };
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    copyFileSync(join(ROOT, 'Makefile'), join(root, 'Makefile'));
    writeFileSync(join(root, 'node_modules/.install'), '');
    const [older, installed] = [new Date(Date.now() - 120_000), new Date(Date.now() - 60_000)];
    utimesSync(join(root, 'package.json'), older, older);
    utimesSync(join(root, 'package-lock.json'), older, older);
    utimesSync(join(root, 'node_modules/.install'), installed, installed);
    mkdirSync(join(outside, 'bin'));
    writeFileSync(join(outside, 'bin/npm'), NPM);
    chmodSync(join(outside, 'bin/npm'), 0o755);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '--all'], { cwd: root });
    const log = join(outside, 'npm.log');
    const environment = {
        ...process.env,
        NPM_LOG: log,
        PATH: `${join(outside, 'bin')}:${process.env.PATH ?? ''}`,
        STAGE: join(outside, 'stage'),
    };

    return {
        make: (target) => {
            writeFileSync(log, '');
            execFileSync('make', ['--no-print-directory', target], {
                cwd: root,
                env: environment,
                stdio: 'pipe',
            });

            return readFileSync(log, 'utf8').split('\n').filter(Boolean);
        },
        root,
    };
}

function touchedLater(path: string): void {
    const later = new Date(Date.now() + 120_000);
    utimesSync(path, later, later);
}

describe('build stamp', () => {
    test('make build — builds a tree once, and again on every change of what the build reads: a source, an untracked file, the install, or a dist/ another gesture wrote or removed', () => {
        // Given - a repository on this Makefile, npm standing in for the build
        const { make, root } = repository();
        const first = make('build');
        const again = make('build');
        appendFileSync(join(root, 'src/a.ts'), '// edited\n');
        const source = make('build');
        appendFileSync(join(root, 'specs/a.spec.ts'), 'edited\n');
        const spec = make('build');
        writeFileSync(join(root, 'src/b.ts'), 'export {};\n');
        const untracked = make('build');
        writeFileSync(join(root, 'node_modules/.package-lock.json'), '{"a":1}\n');
        const install = make('build');
        touchedLater(join(root, 'dist/typescript.js'));
        const touchedDist = make('build');
        rmSync(join(root, 'dist'), { recursive: true });
        const removedDist = make('build');
        const settled = make('build');

        // Then - an unchanged tree or a spec's edit builds nothing; every other change builds once
        expect({
            again,
            first,
            install,
            removedDist,
            settled,
            source,
            spec,
            touchedDist,
            untracked,
        }).toStrictEqual({
            again: [],
            first: ['build'],
            install: ['build'],
            removedDist: ['build'],
            settled: [],
            source: ['build'],
            spec: [],
            touchedDist: ['build'],
            untracked: ['build'],
        });
    });

    test('make install-self — lays the copy of the tarball once per build, and again once the install or the copy moved', () => {
        // Given - a repository on this Makefile, built and installed once, then installed again, rebuilt, reinstalled and its copy removed
        const { make, root } = repository();
        make('install-self');
        const laid = existsSync(join(root, 'node_modules/@jterrazz/typescript/dist/typescript.js'));
        const again = make('install-self');
        appendFileSync(join(root, 'src/a.ts'), '// edited\n');
        const rebuilt = make('install-self');
        touchedLater(join(root, 'node_modules/.install'));
        const installed = make('install-self');
        rmSync(join(root, 'node_modules/@jterrazz/typescript'), { recursive: true });
        const removed = make('install-self');

        // Then - the copy holds the build, a second run lays nothing, and a new build, a new install or a removed copy lays it again
        expect({ again, installed, laid, rebuilt, removed }).toStrictEqual({
            again: [],
            installed: ['pack'],
            laid: true,
            rebuilt: ['build', 'pack'],
            removed: ['pack'],
        });
    });
});
