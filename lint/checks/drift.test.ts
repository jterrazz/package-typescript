import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');

const DRIFT = resolve(import.meta.dirname, 'drift.js');
const OXLINT = join(PACKAGE_ROOT, 'node_modules/.bin/oxlint');
const DEFAULT_PROFILE = join(PACKAGE_ROOT, 'src/presets/oxlint/profiles/node.js');

function configlessProject(files: Record<string, string> = {}): string {
    const directory = mkdtempSync(resolve(tmpdir(), 'check-drift-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    writeFileSync(
        join(directory, 'package.json'),
        '{ "name": "check-drift", "private": true, "type": "module" }\n',
    );
    writeFileSync(join(directory, 'index.ts'), 'export const title = "spec";\n');
    for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(directory, name), content);
    }

    return directory;
}

describe('drift', () => {
    test('reads a baseline file that is not JSON as unreadable, for a person and a machine', () => {
        // Given - a configless project whose jterrazz.baseline.json does not parse
        const directory = configlessProject({ 'jterrazz.baseline.json': '{ not json\n' });
        const args = [DRIFT, directory, '--oxlint', OXLINT, '-c', DEFAULT_PROFILE];

        // When - the drift report reads it, then reads it for a machine
        const human = spawnSync('node', args, { encoding: 'utf8' });
        const machine = spawnSync('node', [...args, '--json'], { encoding: 'utf8' });

        // Then - neither reading claims a count the file was never read for
        expect(human.stdout).toContain('jterrazz.baseline.json › typescript  unreadable\n');
        expect(human.stdout).not.toContain('nothing held');
        expect(JSON.parse(machine.stdout)).toMatchObject({
            baseline: 'unreadable',
            testBaseline: 'unreadable',
        });
    });

    test('prints no test row for a person when the baseline file is unreadable', () => {
        // Given - a configless project whose jterrazz.baseline.json does not parse
        const directory = configlessProject({ 'jterrazz.baseline.json': '{ not json\n' });

        // When - the drift report reads it for a person
        const human = spawnSync(
            'node',
            [DRIFT, directory, '--oxlint', OXLINT, '-c', DEFAULT_PROFILE],
            {
                encoding: 'utf8',
            },
        );

        // Then - a file never read says no test section is kept, so no row claims one
        expect(human.stdout).not.toContain('jterrazz.baseline.json › test');
        expect(human.status).toBe(0);
    });

    test('keeps an emptied section apart from an absent one for a machine', () => {
        // Given - a configless project keeping a typescript section with no entry, and no test section
        const directory = configlessProject({ 'jterrazz.baseline.json': '{ "typescript": {} }\n' });

        // When - the drift report reads it for a machine
        const machine = spawnSync(
            'node',
            [DRIFT, directory, '--oxlint', OXLINT, '-c', DEFAULT_PROFILE, '--json'],
            { encoding: 'utf8' },
        );

        // Then - the emptied section totals 0, the absent one is null
        expect(JSON.parse(machine.stdout)).toMatchObject({ baseline: 0, testBaseline: null });
        expect(machine.status).toBe(0);
    });

    test('resolves the default profile once for a project with no config of its own', () => {
        // Given - a configless project, and a linter that notes each config it is asked to print
        const directory = configlessProject();
        const calls = join(directory, 'print-config.log');
        const counting = join(directory, 'counting-oxlint.sh');
        writeFileSync(
            counting,
            `#!/usr/bin/env bash\ncase " $* " in *" --print-config "*) echo called >> '${calls}' ;; esac\nexec '${OXLINT}' "$@"\n`,
        );
        chmodSync(counting, 0o755);

        // When - the drift report measures it against the handed default
        const result = spawnSync(
            'node',
            [DRIFT, directory, '--oxlint', counting, '-c', DEFAULT_PROFILE],
            {
                encoding: 'utf8',
            },
        );

        // Then - the default IS the profile, so one resolution serves both sides
        expect(result.stdout).toContain('rules off vs profile                 none\n');
        expect(readFileSync(calls, 'utf8')).toBe('called\n');
    });
});
