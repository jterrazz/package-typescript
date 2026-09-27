import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { LINT_TREE } from '../catalogue/preset.js';
import { lsLintFindings } from './names.ls-lint.js';

function onDisk(paths: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'names-ls-lint-'));
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), 'export {};\n');
    }

    return root;
}

describe('names.ls-lint', () => {
    test('names only what the sweep holds, a refused file, a refused directory and one listed whole', () => {
        // Given - ls-lint refusing an ignored scratch file, a directory holding only ignored files, and consumer/ listed whole beside Finder's file
        const root = onDisk([
            'lint/consumer/.DS_Store',
            'lint/consumer/listing.ts',
            'lint/scratch.ts',
            'src/Api_Client/client.ts',
        ]);
        const failures = {
            'lint/consumer': { '.*': ['exists:0'] },
            'lint/scratch.ts': { '.*': ['regex:index'] },
            'src/Api_Client': { '.dir': ['regex:kebab'] },
        };

        // When - the failures are read against a sweep holding lint/consumer/listing.ts alone
        const findings = lsLintFindings(root, {
            failures,
            swept: ['lint/consumer/listing.ts'],
            tree: LINT_TREE,
            units: [''],
        });
        rmSync(root, { force: true, recursive: true });

        // Then - the file git sees is the one finding
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/consumer-folder-is-known  lint/consumer/listing.ts',
        ]);
    });

    test('judges a file ls-lint never looks at wherever a folder is closed', () => {
        // Given - files with no extension and a dot-file in closed folders, and one in an open folder
        const swept = [
            'lint/NOTES',
            'lint/consumer/.notes',
            'lint/consumer/README',
            'lint/consumer/checks/README',
            'skills/a/LICENSE',
            'skills/a/SKILL.md',
        ];

        // When - ls-lint reported nothing
        const findings = lsLintFindings(tmpdir(), {
            failures: {},
            swept,
            tree: LINT_TREE,
            units: [''],
        });

        // Then - each file in a closed folder is refused under the rule of its place
        expect(findings.map(({ path, rule }) => `${rule}  ${path}`)).toStrictEqual([
            'names/lint-root-holds-only-index  lint/NOTES',
            'names/consumer-folder-is-known  lint/consumer/.notes',
            'names/consumer-folder-is-known  lint/consumer/README',
            'names/skill-holds-only-skill-md  skills/a/LICENSE',
        ]);
    });
});
