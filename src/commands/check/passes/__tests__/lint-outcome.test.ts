import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { fixReportCarried, lintOutcome } from '../lint-outcome.js';

function logs(): { at: (name: string) => string; directory: string } {
    const directory = mkdtempSync(join(tmpdir(), 'tool-passes-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return { at: (name) => join(directory, name), directory };
}

describe('lintOutcome', () => {
    test('lintOutcome — the fix’s failure wins over the lint that judged what it left, and a fix that passed leaves the lint’s own', () => {
        // Given - a fix that passed and one that failed, over a lint that passed and one that failed
        // Then - the first failure, else the lint
        expect([
            lintOutcome(0, 0),
            lintOutcome(0, 1),
            lintOutcome(2, 0),
            lintOutcome(2, 1),
        ]).toStrictEqual([0, 1, 2, 2]);
    });

    test('fixReportCarried — the report of a fix that failed is appended to the lint log, and that of one that passed is left', () => {
        // Given - a fix report and a lint log holding its own lines
        const check = { logs: logs() };
        writeFileSync(check.logs.at('fix-scopes.log'), 'fix failed: scope a\n');
        writeFileSync(check.logs.at('lint.log'), 'lint says\n');

        // When - a passed fix, then a failed one, are carried
        fixReportCarried(check, 0);
        const afterPassed = readFileSync(check.logs.at('lint.log'), 'utf8');
        fixReportCarried(check, 1);

        // Then - the lint log is untouched, then holds the report after its own lines
        expect([afterPassed, readFileSync(check.logs.at('lint.log'), 'utf8')]).toStrictEqual([
            'lint says\n',
            'lint says\nfix failed: scope a\n',
        ]);
    });
});
