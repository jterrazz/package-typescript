import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const BUILT_FROM = resolve(import.meta.dirname, '../../..');

const CHECKER = join(BUILT_FROM, 'dist/checker.js');

function rootHolding(baseline: string): string {
    const root = mkdtempSync(resolve(tmpdir(), 'ratchet-baseline-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, 'jterrazz.baseline.json'), baseline);

    return root;
}

describe('baseline', () => {
    test('refuses an oxlint rule the section still holds, and passes the passes it holds', () => {
        // Given - a section holding a Names entry beside an oxlint rule recorded before oxlint held its own
        const root = rootHolding(
            '{ "typescript": { "eslint/no-var": 1, "names/no-language-construct-name": 2 } }\n',
        );

        // When - the section is read
        const result = spawnSync('node', [CHECKER, 'baseline', root], { encoding: 'utf8' });

        // Then - the oxlint rule is refused in four parts, the Names entry is not
        expect(result.stdout).toBe(
            "baseline-moved-to-oxlint  jterrazz.baseline.json › typescript  found: `eslint/no-var` is an oxlint rule, and the section holds its count · why: oxlint holds its own rules in oxlint-suppressions.json, file by file, so the section holds only the passes of this toolchain · fix: run 'typescript baseline', which records the lint debt in oxlint-suppressions.json and drops the entry · read: docs/06-quality-checks.md#the-ratchet\n",
        );
        expect(result.status).toBe(1);
    });

    test('refuses to rewrite the section when the Names pass wrote no report', () => {
        // Given - a section holding a Names entry, and no Names report
        const baseline = '{ "typescript": { "names/no-language-construct-name": 2 } }\n';
        const root = rootHolding(baseline);

        // When - the section is recorded
        const result = spawnSync(
            'node',
            [CHECKER, 'baseline', root, '--names', join(root, 'names.json'), '--write'],
            { encoding: 'utf8' },
        );

        // Then - it is refused, and every byte of the file is as it was
        expect(result.stdout).toBe(
            "found: the Names (tree) pass wrote no report, so the typescript section is left as it was · why: a section written without that pass's counts would erase its debt rather than record it · fix: run 'typescript check', which prints why the pass could not judge the tree, correct that, then run 'typescript baseline' again · read: docs/06-quality-checks.md#recording-it\n",
        );
        expect(result.status).toBe(1);
        expect(readFileSync(join(root, 'jterrazz.baseline.json'), 'utf8')).toBe(baseline);
    });
});
