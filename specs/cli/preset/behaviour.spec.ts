import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { diagnosticsOf, oxlint, PROFILES, sandbox } from './rulebook.js';
import type { Diagnostic } from './rulebook.js';

/*
 * What a decision DOES, on a file that breaks it. One case per decision this
 * package owns — a reasoned `off`, an option we set against upstream's default,
 * the extension convention — and never one per upstream rule: the library tests
 * its own rules, and repeating that here would only pin oxlint's behaviour to
 * our goldens.
 *
 * Two goldens per profile, and the split is the point. The tree under
 * `_expected/behaviour/<profile>/` holds ONLY the files `--fix` rewrote, so the
 * diff of a pull request is exactly the behavioural delta; a file the fixer
 * leaves alone is absent, which is how a reasoned `off` states itself. The
 * report golden beside it is what still speaks after the fix.
 *
 * Regenerate both with `TEST_UPDATE=1 npm test`.
 */

const FIXTURES = resolve(import.meta.dirname, '_fixtures/behaviour');
const EXPECTED = resolve(import.meta.dirname, '_expected/behaviour');
const UPDATING = process.env.TEST_UPDATE === '1';

/** The rule ids a run names, with the file each one landed on, sorted. */
function rulesOf(diagnostics: Diagnostic[]): string {
    const lines = diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => `${diagnostic.filename} ${diagnostic.code}`);
    return `${lines.toSorted((left, right) => left.localeCompare(right)).join('\n')}\n`;
}

test.each(PROFILES)('$name fixes what it owns and says what it refuses', ({ name, tsconfig }) => {
    // Given - a tree breaking one decision per line, fixed once
    const input = resolve(FIXTURES, name, 'input');
    using work = sandbox(input, name, tsconfig);
    oxlint(work.path, ['-c', work.config, '--fix', ...work.files]);

    // Then - every file the fixer rewrote matches its golden, and no other file is committed
    const tree = resolve(EXPECTED, name);
    const rewritten = work.files.filter(
        (file) =>
            readFileSync(resolve(work.path, file), 'utf8') !==
            readFileSync(resolve(input, file), 'utf8'),
    );

    if (UPDATING) {
        rmSync(tree, { force: true, recursive: true });
        mkdirSync(tree, { recursive: true });
        for (const file of rewritten) {
            writeFileSync(resolve(tree, file), readFileSync(resolve(work.path, file), 'utf8'));
        }
    }

    expect(existsSync(tree) ? readdirSync(tree).toSorted() : []).toStrictEqual(
        rewritten.toSorted(),
    );
    for (const file of rewritten) {
        expect
            .soft(readFileSync(resolve(work.path, file), 'utf8'), `${name}/${file}`)
            .toBe(readFileSync(resolve(tree, file), 'utf8'));
    }

    // Then - what the fixer cannot repair is exactly the report the golden records
    const golden = resolve(EXPECTED, `${name}.report.txt`);
    const report = rulesOf(
        diagnosticsOf(oxlint(work.path, ['-c', work.config, '--format=json', ...work.files])),
    );
    if (UPDATING) {
        writeFileSync(golden, report);
    }
    expect(report).toBe(readFileSync(golden, 'utf8'));
});

test('the hexagonal layer map refuses an edge and carves out features/common', () => {
    // Given - a hexagonal tree with one legal import and one edge per layer, linted by the node profile composed with the hexagonal map
    using work = sandbox(resolve(FIXTURES, 'hexagonal', 'input'), 'node', 'node', ['hexagonal']);
    const report = oxlint(work.path, ['-c', work.config, '--format=json', ...work.files]);

    // Then - each edge is named, and only the file that crosses it
    const named = diagnosticsOf(report)
        .filter((diagnostic) => diagnostic.code.includes('no-restricted-imports'))
        .map((diagnostic) => diagnostic.filename)
        .toSorted((left, right) => left.localeCompare(right));

    expect(named).toStrictEqual([
        'application/use-cases/broken.ts',
        'domain/broken.entity.ts',
        'presentation/features/alpha/reads-beta.ts',
    ]);
});
