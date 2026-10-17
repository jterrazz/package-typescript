import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { originalOf } from '../../../kit/project/sandbox.js';
import { shippedModules } from '../../../kit/testing/shipped-modules.js';
import { headingsOf, refusalFindings, refusalLine } from '../refusals.js';

const ROOT = originalOf(resolve(import.meta.dirname, '../../../..'));

function linesOf(module: string): string[] {
    const scratch = mkdtempSync(join(tmpdir(), 'refusals-'));
    try {
        mkdirSync(join(scratch, 'docs'));
        writeFileSync(join(scratch, 'docs/05-guide.md'), '# Guide\n\n### Time\n');
        writeFileSync(join(scratch, 'module.ts'), module);

        return refusalFindings(scratch, ['module.ts']).map((finding) => refusalLine(finding));
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}

describe('refusals', () => {
    test('every error a shipped module constructs is a refusal reading a heading that exists, or an invariant', () => {
        // Given - every shipped module of lint/ and src/
        const modules = ['lint', 'src'].flatMap((folder) =>
            shippedModules(ROOT, join(ROOT, folder)),
        );
        expect(modules.length).toBeGreaterThan(50);

        // Then - none is found, each finding printed at its position
        expect(refusalFindings(ROOT, modules).map((finding) => refusalLine(finding))).toStrictEqual(
            [],
        );
    });

    test('names each hand-written construction at its position, and passes the declared forms and a stack read', () => {
        // Given - each spelling of a hand-written error beside the declared forms
        const lines = linesOf(`class EmptySweepError extends Error {}
export function all(pinned: boolean): unknown[] {
    const { stack } = new Error('the call site');
    return [
        stack,
        new TypeError(refusal({ fix: 'f', found: 'x', read: 'docs/05-guide.md#time', why: 'w' })),
        invariant('x'),
        new Error('x'),
        TypeError(\`x\`),
        new EmptySweepError('x'),
        new Error(refusal({ fix: 'f', found: 'x', read: pinned ? 'docs/05-guide.md#time' : 'docs/05-guide.md#clock', why: 'w' })),
    ];
}
`);

        // Then - each hand-written one and the missing heading is one line, at its line and column, in four parts
        expect(lines).toStrictEqual([
            "module.ts:8:9  error-is-a-refusal-or-an-invariant  found: `new Error(...)` carries a message written by hand · why: an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours · fix: a project can cause it: `new Error(refusal({ found, why, fix, read }))`, its read the heading that explains it; only the toolchain can: `invariant('<what broke>')` · read: docs/guides/test.md#where-each-rule-declares-it",
            "module.ts:9:9  error-is-a-refusal-or-an-invariant  found: `TypeError(...)` carries a message written by hand · why: an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours · fix: a project can cause it: `new TypeError(refusal({ found, why, fix, read }))`, its read the heading that explains it; only the toolchain can: `invariant('<what broke>')` · read: docs/guides/test.md#where-each-rule-declares-it",
            "module.ts:10:9  error-is-a-refusal-or-an-invariant  found: `new EmptySweepError(...)` carries a message written by hand · why: an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours · fix: a project can cause it: `new EmptySweepError(refusal({ found, why, fix, read }))`, its read the heading that explains it; only the toolchain can: `invariant('<what broke>')` · read: docs/guides/test.md#where-each-rule-declares-it",
            'module.ts:11:92  error-is-a-refusal-or-an-invariant  found: `docs/05-guide.md#clock` names a heading no chapter has · why: an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours · fix: read a heading that exists, and write the section that explains the refusal where none does · read: docs/guides/test.md#where-each-rule-declares-it',
        ]);
    });

    test('names a refusal whose read is not written in place', () => {
        // Given - a refusal reading a variable
        const lines = linesOf(`export function pinned(read: string): Error {
    return new Error(refusal({ fix: 'f', found: 'x', read, why: 'w' }));
}
`);

        // Then - the read is named at its property
        expect(lines).toStrictEqual([
            "module.ts:2:54  error-is-a-refusal-or-an-invariant  found: the refusal reads no chapter written in place · why: an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours · fix: write the heading it reads in place: `read: 'docs/<chapter>.md#<heading>'` · read: docs/guides/test.md#where-each-rule-declares-it",
        ]);
    });

    test('reads a heading as the chapter renders its anchor', () => {
        // Given - a chapter with headings carrying code and punctuation
        const chapter = '# Title\n\n### A map the compiler refuses\n\n## `compose()` semantics\n';

        // Then - each heading answers to the anchor a link names
        expect([...headingsOf(chapter)]).toStrictEqual([
            'title',
            'a-map-the-compiler-refuses',
            'compose-semantics',
        ]);
    });
});
