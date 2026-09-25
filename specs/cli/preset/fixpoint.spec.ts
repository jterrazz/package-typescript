import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { diagnosticsOf, oxfmt, oxlint, PROFILES, sandbox } from './rulebook.js';

// Two rounds of `oxlint --fix` then `oxfmt` must land on the same bytes over shapes the two tools both rewrite.

const FIXTURES = resolve(import.meta.dirname, 'fixtures/fixpoint');

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
});
