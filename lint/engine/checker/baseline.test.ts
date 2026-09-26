import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const CHECKER = resolve(import.meta.dirname, '../../index.checker.js');

function groundOf(baseline: string): { report: string; root: string } {
    const root = mkdtempSync(resolve(tmpdir(), 'ratchet-baseline-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, 'jterrazz.baseline.json'), baseline);
    const report = join(root, 'lint.json');
    writeFileSync(report, '{ "diagnostics": [] }\n');

    return { report, root };
}

describe('baseline', () => {
    test('prints no held line for a kept section when the Names pass wrote no report', () => {
        // Given - a root keeping an empty typescript section, and a Names report that was never written
        const { report, root } = groundOf('{ "typescript": {} }\n');

        // When - the judge reads a clean linter report
        const result = spawnSync(
            'node',
            [CHECKER, 'baseline', report, root, '--names', join(root, 'names.json')],
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
            [CHECKER, 'baseline', report, root, '--names', join(root, 'names.json'), '--write'],
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
