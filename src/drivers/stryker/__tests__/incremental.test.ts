import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { incrementalKeptWhileGroundHolds } from '../incremental.js';

const roots: string[] = [];

function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'incremental-'));
    roots.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    mkdirSync(join(root, '.artifacts/stryker'), { recursive: true });

    return root;
}

const incrementalOf = (root: string): string =>
    join(root, '.artifacts/stryker/suite-incremental.json');

afterEach(() => {
    for (const root of roots.splice(0)) {
        rmSync(root, { force: true, recursive: true });
    }
});

describe('incrementalKeptWhileGroundHolds', () => {
    test('incremental — keeps the report while the ground its tests read is the one it was written on, and drops it when a fixture changes', () => {
        // Given - a report written on one fixture
        const root = projectWith({
            'specs/a.spec.ts': 'test',
            'specs/__fixtures__/input.json': '{"a":1}',
        });
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');
        writeFileSync(incrementalOf(root), '{}');

        // When - the run starts again on the same ground
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');

        // Then - the report is kept
        expect(existsSync(incrementalOf(root))).toBe(true);

        // When - the fixture changes and the test file does not
        writeFileSync(join(root, 'specs/__fixtures__/input.json'), '{"a":2}');
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');

        // Then - the report is gone, so no verdict of it is reused
        expect(existsSync(incrementalOf(root))).toBe(false);
    });

    test('incremental — drops a report no ground was recorded for', () => {
        // Given - a report left by a run that recorded no ground
        const root = projectWith({ 'specs/__expected__/out.txt': 'one' });
        writeFileSync(incrementalOf(root), '{}');

        // When - a run starts
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');

        // Then - it starts from nothing
        expect(existsSync(incrementalOf(root))).toBe(false);
    });

    test.each([
        ['a golden', 'specs/__expected__/out.txt', 'two'],
        ['a setup file', 'specs/__setup__/seed.ts', 'export const x = 1;'],
        ['a request', 'specs/__requests__/call.http', 'GET /changed'],
        ['a seed', 'specs/__seeds__/rows.json', '[2]'],
    ])('incremental — drops the report when %s changes under it', (_kind, path, changed) => {
        // Given - a report written on the ground as it stands
        const root = projectWith({
            'specs/__expected__/out.txt': 'one',
            'specs/__requests__/call.http': 'GET /call',
            'specs/__seeds__/rows.json': '[1]',
            'specs/__setup__/seed.ts': 'export {}',
        });
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');
        writeFileSync(incrementalOf(root), '{}');

        // When - that file changes and the run starts again
        writeFileSync(join(root, path), changed);
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');

        // Then - the report is gone
        expect(existsSync(incrementalOf(root))).toBe(false);
    });

    test('incremental — a cold start drops the report although the ground held, and records the ground again', () => {
        // Given - a report written on the ground as it stands
        const root = projectWith({ 'specs/__fixtures__/f.txt': 'f' });
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');
        writeFileSync(incrementalOf(root), '{}');

        // When - a gate starts the run cold, then a run that is not cold follows on the same ground
        incrementalKeptWhileGroundHolds(root, 'suite-incremental', { cold: true });
        const droppedCold = !existsSync(incrementalOf(root));
        writeFileSync(incrementalOf(root), '{}');
        incrementalKeptWhileGroundHolds(root, 'suite-incremental', { cold: false });

        // Then - the cold start dropped the report, and the stamp it wrote lets the next report stand
        expect([droppedCold, existsSync(incrementalOf(root))]).toStrictEqual([true, true]);
    });

    test('incremental — keeps the report when only code outside the ground changes', () => {
        // Given - a report and a source
        const root = projectWith({ 'src/a.ts': 'one', 'specs/__fixtures__/f.txt': 'f' });
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');
        writeFileSync(incrementalOf(root), '{}');

        // When - the source changes
        writeFileSync(join(root, 'src/a.ts'), 'two');
        incrementalKeptWhileGroundHolds(root, 'suite-incremental');

        // Then - Stryker's own source key decides, and the report stays
        expect(existsSync(incrementalOf(root))).toBe(true);
    });
});
