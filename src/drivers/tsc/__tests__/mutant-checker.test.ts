import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { mutatedText, NativeChecker } from '../mutant-checker.js';
import type { CheckedMutant } from '../mutant-checker.js';

const TSCONFIG = JSON.stringify({
    compilerOptions: {
        module: 'nodenext',
        moduleDetection: 'legacy',
        noEmit: true,
        noUnusedLocals: true,
        strict: true,
        target: 'es2022',
        types: [],
    },
    include: ['src'],
});

function projectWith(files: Readonly<Record<string, string>>): string {
    const project = mkdtempSync(join(tmpdir(), 'mutant-checker-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    mkdirSync(join(project, 'src'));
    for (const [name, text] of Object.entries(files)) {
        writeFileSync(join(project, name), text);
    }

    return project;
}

async function checkerOf(project: string): Promise<NativeChecker> {
    const checker = new NativeChecker(project);
    onTestFinished(async () => {
        await checker.dispose();
    });
    await checker.init();

    return checker;
}

const mutant = (
    id: string,
    fileName: string,
    [line, from, to]: readonly [number, number, number],
    replacement: string,
): CheckedMutant => ({
    fileName,
    id,
    location: { end: { column: to, line }, start: { column: from, line } },
    replacement,
});

const statuses = (results: Readonly<Record<string, { status: string }>>): Record<string, string> =>
    Object.fromEntries(Object.entries(results).map(([id, { status }]) => [id, status]));

describe('mutant-checker', () => {
    test('mutatedText — the replacement stands in the zero-based span it mutates, across lines', () => {
        // Given - a span from the second line's third column to the third line's second
        const text = 'one\ntwo three\nfour\n';

        // Then - the text before the span, the replacement, the text after it
        expect(mutatedText(text, mutant('0', 'a.ts', [1, 2, 6], 'X'))).toBe('one\ntwXree\nfour\n');
        expect(
            mutatedText(text, {
                ...mutant('1', 'a.ts', [1, 4, 4], ''),
                location: { end: { column: 2, line: 2 }, start: { column: 4, line: 1 } },
            }),
        ).toBe('one\ntwo ur\n');
    });

    test('a mutant that breaks its own file, an importer two imports away, or a file only its globals reach is a compile error; one that changes no type passes, as does one outside the project', async () => {
        // Given - a constant whose literal type reaches a file through a re-export, a function, and a script whose global a module reads
        const project = projectWith({
            'src/fast.ts':
                "import { picked } from './picked.js';\n\nexport const fast: 'fast' = picked;\n",
            'src/global.ts': 'const LIMIT = 1;\n',
            'src/limit.ts': 'export const limit: 1 = LIMIT;\n',
            'src/mode.ts': "export const mode = 'fast';\n\nexport const size = (): number => 1;\n",
            'src/picked.ts': "import { mode } from './mode.js';\n\nexport const picked = mode;\n",
            'tsconfig.json': TSCONFIG,
        });
        const checker = await checkerOf(project);

        // When - each mutant checked on the unmutated tree
        const results = await checker.check([
            mutant('own', 'src/mode.ts', [2, 34, 35], "'one'"),
            mutant('body', 'src/mode.ts', [2, 34, 35], '2'),
            mutant('far', 'src/mode.ts', [0, 20, 26], "''"),
            mutant('global', 'src/global.ts', [0, 14, 15], '2'),
            mutant('outside', 'other/elsewhere.ts', [0, 0, 1], 'x'),
        ]);

        // Then - the own file's error, the far importer's and the global reader's are each the mutant's, at the file that refuses it
        expect(statuses(results)).toStrictEqual({
            body: 'passed',
            far: 'compileError',
            global: 'compileError',
            outside: 'passed',
            own: 'compileError',
        });
        expect([results.own, results.far, results.global]).toStrictEqual([
            {
                reason: "src/mode.ts:3 TS2322 Type 'string' is not assignable to type 'number'.",
                status: 'compileError',
            },
            {
                reason: 'src/fast.ts:3 TS2322 Type \'""\' is not assignable to type \'"fast"\'.',
                status: 'compileError',
            },
            {
                reason: "src/limit.ts:1 TS2322 Type '2' is not assignable to type '1'.",
                status: 'compileError',
            },
        ]);
    });

    test('a mutant that leaves a local unused or code unreachable passes: the checker turns those errors off', async () => {
        // Given - a project that refuses an unused local, whose function returns early only under a mutant
        const project = projectWith({
            'src/early.ts':
                'export function early(): number {\n    const kept = 1;\n    return kept;\n}\n',
            'tsconfig.json': TSCONFIG,
        });
        const checker = await checkerOf(project);

        // When - the return value replaced, leaving the local unused
        const results = await checker.check([mutant('unused', 'src/early.ts', [2, 11, 15], '2')]);

        // Then - no error is the mutant's
        expect(statuses(results)).toStrictEqual({ unused: 'passed' });
    });

    test('a tree that does not compile before any mutant is refused at its first error', async () => {
        // Given - a tree whose file assigns a string to a number
        const project = projectWith({
            'src/a.ts': "export const a: number = 'one';\n",
            'tsconfig.json': TSCONFIG,
        });

        const checker = new NativeChecker(project);
        onTestFinished(async () => {
            await checker.dispose();
        });

        // Then - the checker refuses to start, naming the error at its file and line
        await expect(checker.init()).rejects.toThrow(
            "found: the tree does not compile before any mutant: src/a.ts:1 TS2322 Type 'string' is not assignable to type 'number'.",
        );
    });
});
