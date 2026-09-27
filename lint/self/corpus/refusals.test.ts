import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { shippedModules } from '../../engine/testing/shipped-modules.js';
import { handWrittenErrors, headingsOf, LESSON_MODULE, unreadHeadings } from './refusals.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const judged = ['lint', 'src']
    .flatMap((folder) => shippedModules(ROOT, join(ROOT, folder)))
    .filter((module) => module !== LESSON_MODULE);

describe('refusals', () => {
    test('every error a shipped module constructs is a refusal, and every refusal reads a heading that exists', () => {
        // Given - every shipped module but the one that builds the two declared forms
        expect(judged.length).toBeGreaterThan(50);

        // Then - no error carries a message written by hand, and no refusal reads a heading no chapter has
        for (const module of judged) {
            const source = readFileSync(join(ROOT, module), 'utf8');
            expect
                .soft(handWrittenErrors(source), `${module} writes an error by hand`)
                .toStrictEqual([]);
            expect
                .soft(unreadHeadings(source, ROOT), `${module} reads no heading`)
                .toStrictEqual([]);
        }
    });

    test('a construction counts however it is spelled, and a refusal or a stack read does not', () => {
        // Given - each spelling of a hand-written error, and each of the declared forms
        const written = [
            "throw new Error('x');",
            'throw new TypeError(`x`);',
            "reject(new EmptySweepError('x'));",
            "throw Error('x');",
        ];
        const declared = ['throw new TypeError(refusal({ found }));', "throw invariant('x');"];

        // Then - each hand-written one counts once, and neither declared form counts
        for (const line of written) {
            expect.soft(handWrittenErrors(line), line).toHaveLength(1);
        }
        for (const line of declared) {
            expect.soft(handWrittenErrors(line), line).toStrictEqual([]);
        }
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
