import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { diagnosticsOf, oxfmt, oxlint, PROFILES, sandbox } from '../../_shared/_setup/rulebook.js';

// invariant: two rounds of `oxlint --fix` then `oxfmt` must land on the same bytes over shapes the two tools both rewrite.

const FIXTURES = resolve(import.meta.dirname, '_fixtures/fixpoint');

function snapshot(directory: string): Record<string, string> {
    const files: Record<string, string> = {};
    for (const name of readdirSync(directory).toSorted()) {
        if (name.endsWith('.ts') || name.endsWith('.tsx')) {
            files[name] = readFileSync(resolve(directory, name), 'utf8');
        }
    }
    return files;
}

describe('fixpoint', () => {
    test.each(PROFILES)(
        '$name reaches a fixpoint with no diagnostic left',
        ({ name, tsconfig }) => {
            // Given - the ping-pong fixture, fixed and formatted once
            using work = sandbox(resolve(FIXTURES, name), name, tsconfig);
            const round = () => {
                oxlint(work.path, ['-c', work.config, '--fix', ...work.files]);
                oxfmt(work.path, work.files);
            };
            round();
            const first = snapshot(work.path);

            // Then - a second round changes nothing
            round();
            expect(snapshot(work.path)).toStrictEqual(first);

            // Then - and the settled bytes carry no diagnostic at all
            const report = oxlint(work.path, ['-c', work.config, '--format=json', ...work.files]);
            expect(diagnosticsOf(report), `${name} still reports on a settled tree`).toStrictEqual(
                [],
            );
            expect(report.status).toBe(0);
        },
    );

    test('keeps a fixpoint ground only for a profile the rulebook ships', () => {
        // Given - every profile folder of the fixpoint fixtures
        const owners = new Set<string>(PROFILES.map(({ name }) => name));

        // Then - each one is named for a shipped profile, and none outlives one
        expect(readdirSync(FIXTURES).filter((entry) => !owners.has(entry))).toStrictEqual([]);
    });
});
