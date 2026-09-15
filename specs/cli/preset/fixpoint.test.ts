import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { oxfmt, oxlint, PROFILES, sandbox } from './rulebook.js';

/*
 * Law 2's proof. A lint fixer and the formatter can rewrite each other for
 * ever: unicorn parenthesises a nested ternary and oxfmt strips the
 * parentheses; unicorn upper-cases a hex literal and oxfmt lower-cases it. Two
 * rounds of `oxlint --fix` then `oxfmt` must land on the same bytes and report
 * nothing.
 *
 * One test replaces every "does rule X fight the formatter" question, and
 * catches the next one before a consumer does. The fixture deliberately holds
 * the shapes that have ping-ponged before.
 */

const FIXTURES = resolve(import.meta.dirname, '_fixtures/fixpoint');

/** Every source file of a sandbox, by name, with its bytes. */
function snapshot(directory: string): Record<string, string> {
    const files: Record<string, string> = {};
    for (const name of readdirSync(directory).toSorted()) {
        if (name.endsWith('.ts') || name.endsWith('.tsx')) {
            files[name] = readFileSync(resolve(directory, name), 'utf8');
        }
    }
    return files;
}

test.each(PROFILES)('$name reaches a fixpoint with no diagnostic left', ({ name, tsconfig }) => {
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
    const report = oxlint(work.path, ['-c', work.config, ...work.files]);
    expect(report.stdout, `${name} still reports on a settled tree`).toBe('');
    expect(report.status).toBe(0);
});
