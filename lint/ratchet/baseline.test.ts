import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { heldSummary, judge, tightened } from './baseline.js';

const JUDGE = resolve(import.meta.dirname, 'baseline.js');

function groundOf(baseline: string): { report: string; root: string } {
    const root = mkdtempSync(resolve(tmpdir(), 'check-baseline-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, 'jterrazz.baseline.json'), baseline);
    const report = join(root, 'lint.json');
    writeFileSync(report, '{ "diagnostics": [] }\n');

    return { report, root };
}

const linterOwns = (rule: string): boolean => !rule.startsWith('names/');

describe('baseline', () => {
    test('breaks on a count below its entry, and holds one at it', () => {
        // Given - one rule that fell and one that stands at its entry
        const counts = { 'eslint/no-debugger': 1, 'eslint/no-var': 3 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - the fall is the one finding
        expect(judge(counts, baseline)).toStrictEqual([
            'eslint/no-debugger is at 1, below its baseline of 2 — the debt fell, `typescript fix` re-records it',
        ]);
    });

    test('lowers an entry that fell and drops one at zero', () => {
        // Given - one rule that fell, one paid in full, one that stands
        const counts = { 'eslint/no-debugger': 1, 'eslint/no-var': 3 };
        const baseline = { 'eslint/eqeqeq': 4, 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - the section records where the project stands
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-debugger': 1,
            'eslint/no-var': 3,
        });
    });

    test('never raises an entry nor adds a key', () => {
        // Given - one rule that rose, one new, and one that fell
        const counts = { 'eslint/no-debugger': 5, 'eslint/no-unused-vars': 2, 'eslint/no-var': 1 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - only the fall moves; the rise and the new rule stay for the verdict
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-debugger': 2,
            'eslint/no-var': 1,
        });
    });

    test("keeps every entry it does not own, whatever that entry's count", () => {
        // Given - a Names entry the linter half does not count
        const counts = { 'eslint/no-var': 1 };
        const baseline = { 'eslint/no-var': 3, 'names/no-language-construct-name': 2 };

        // Then - the Names entry is the Names pass's to re-record
        expect(tightened(counts, baseline, linterOwns)).toStrictEqual({
            'eslint/no-var': 1,
            'names/no-language-construct-name': 2,
        });
    });

    test('records nothing when nothing fell', () => {
        // Given - every entry at its count, and one rule above
        const counts = { 'eslint/no-debugger': 3, 'eslint/no-var': 3 };
        const baseline = { 'eslint/no-debugger': 2, 'eslint/no-var': 3 };

        // Then - there is nothing for a fix to write
        expect(tightened(counts, baseline, linterOwns)).toBeUndefined();
    });

    test('reads an empty section as nothing held', () => {
        // Given - a section holding no entry
        const counts = {};

        // Then - no count, no rule, one phrase
        expect(heldSummary(counts)).toBe('jterrazz.baseline.json › typescript: nothing held');
    });

    test('counts one rule held once in the singular', () => {
        // Given - one rule holding one finding
        const counts = { 'eslint/no-debugger': 1 };

        // Then - the count and the rule, both singular
        expect(heldSummary(counts)).toBe(
            'jterrazz.baseline.json › typescript: 1 held across 1 rule',
        );
    });

    test('prints no held line for a kept section when the Names pass wrote no report', () => {
        // Given - a root keeping an empty typescript section, and a Names report that was never written
        const { report, root } = groundOf('{ "typescript": {} }\n');

        // When - the judge reads a clean linter report
        const result = spawnSync(
            'node',
            [JUDGE, report, root, '--names', join(root, 'names.json')],
            {
                encoding: 'utf8',
            },
        );

        // Then - the linter's side holds, and nothing is claimed for the side nobody read
        expect(result.stdout).toBe('');
        expect(result.status).toBe(0);
    });

    test('refuses to rewrite the section when the Names pass wrote no report', () => {
        // Given - a section holding a Names entry beside a linter one, and no Names report
        const baseline =
            '{ "typescript": { "eslint/no-var": 1, "names/no-language-construct-name": 2 } }\n';
        const { report, root } = groundOf(baseline);

        // When - the section is recorded
        const result = spawnSync(
            'node',
            [JUDGE, report, root, '--names', join(root, 'names.json'), '--write'],
            { encoding: 'utf8' },
        );

        // Then - it is refused, and every byte of the file is as it was
        expect(result.stdout).toBe(
            "the Names (tree) pass wrote no report — the typescript section is left as it was; 'typescript check' prints why\n",
        );
        expect(result.status).toBe(1);
        expect(readFileSync(join(root, 'jterrazz.baseline.json'), 'utf8')).toBe(baseline);
    });
});
