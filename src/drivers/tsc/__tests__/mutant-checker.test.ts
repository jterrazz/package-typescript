import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { importGraphOf, mutatedText, NativeChecker, shapeOf } from '../mutant-checker.js';
import type { CheckedMutant } from '../mutant-checker.js';
import { nativeProject, programOf } from '../native-project.js';
import { childProcesses } from './child-processes.js';

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

    test('every error a mutant causes is told, one to a line', async () => {
        // Given - a file of two constants typed as numbers
        const project = projectWith({
            'src/two.ts': 'export const a: number = 1;\nexport const b: number = 2;\n',
            'tsconfig.json': TSCONFIG,
        });
        const checker = await checkerOf(project);

        // When - one mutant replaces both values with strings
        const results = await checker.check([
            {
                ...mutant('both', 'src/two.ts', [0, 25, 26], "'x';\nexport const b: number = 'y'"),
                location: { end: { column: 26, line: 1 }, start: { column: 25, line: 0 } },
            },
        ]);

        // Then - both errors are its reason, on separate lines
        expect(results.both).toStrictEqual({
            reason: "src/two.ts:1 TS2322 Type 'string' is not assignable to type 'number'.\nsrc/two.ts:2 TS2322 Type 'string' is not assignable to type 'number'.",
            status: 'compileError',
        });
    });

    test('disposing the checker ends the native compiler it opened', async () => {
        // Given - the processes running before, and a started checker
        const before = childProcesses();
        const checker = new NativeChecker(
            projectWith({ 'src/a.ts': 'export const a = 1;\n', 'tsconfig.json': TSCONFIG }),
        );
        await checker.init();

        // When - it is disposed
        await checker.dispose();

        // Then - no process it started is left, once the system has ended it
        await expect.poll(childProcesses, { timeout: 10_000 }).toStrictEqual(before);
    });

    test('a project with no tsconfig.json is refused at start', async () => {
        // Given - a project that keeps none
        const checker = new NativeChecker(projectWith({}));

        // Then - the checker names the cause
        await expect(checker.init()).rejects.toThrow('keeps no tsconfig.json');
    });

    test('maps each file to its importers, and marks the scripts and the modules that augment another as global', () => {
        // Given - a module imported by two files, a script, and a module that augments it
        const project = projectWith({
            'src/aug.ts':
                "import './base.js';\n\ndeclare module './base.js' {\n    interface Base {\n        more: 1;\n    }\n}\n",
            'src/base.ts': 'export interface Base {\n    one: 1;\n}\n',
            'src/script.ts': 'const SCRIPT = 1;\n',
            'src/use.ts': "import type { Base } from './base.js';\n\nexport type Used = Base;\n",
            'tsconfig.json': TSCONFIG,
        });
        const opened = nativeProject(project);
        expect(opened).toBeDefined();
        if (opened === undefined) {
            return;
        }
        onTestFinished(() => {
            opened.base.dispose();
            opened.api.close();
        });
        const program = programOf(opened.base, opened.config);
        const names = ['aug', 'base', 'script', 'use'].map((name) =>
            join(project, `src/${name}.ts`),
        );

        // When - the graph of the four files
        const graph = importGraphOf(program, names);

        // Then - base is imported by aug and use; aug and script are global
        const own = (file: string): string => file.slice(project.length + 1);
        expect([...graph.global].map(own).toSorted()).toStrictEqual([
            'src/aug.ts',
            'src/script.ts',
        ]);
        expect(
            [...graph.importers].map(([file, by]) => [own(file), [...by].map(own).toSorted()]),
        ).toStrictEqual([
            ['src/aug.ts', []],
            ['src/base.ts', ['src/aug.ts', 'src/use.ts']],
            ['src/script.ts', []],
            ['src/use.ts', []],
        ]);
    });

    test('is the declarations a file emits; none for a declaration file, a file that cannot emit them, or a name that only holds one in the middle', () => {
        // Given - a plain, a module, a commonjs and a jsx file, a declaration file named like a source, and a file whose declarations the compiler refuses
        const project = projectWith({
            'src/a.d.ts': 'export declare const a: 1;\n',
            'src/b.mts': 'export const b = 1;\n',
            'src/c.cts': 'export const c = 1;\n',
            'src/d.tsx': 'export const d = 1;\n',
            'src/e.ts': 'export const e = 1;\n',
            'src/f.ts.d.ts': 'export declare const f: 1;\n',
            'src/g.ts':
                'export const g = <T,>(Base: new () => T) => class extends Base { private x = 1; };\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: {
                    jsx: 'preserve',
                    module: 'nodenext',
                    noEmit: true,
                    strict: true,
                    types: [],
                },
                include: ['src'],
            }),
        });
        const opened = nativeProject(project);
        expect(opened).toBeDefined();
        if (opened === undefined) {
            return;
        }
        onTestFinished(() => {
            opened.base.dispose();
            opened.api.close();
        });
        const program = programOf(opened.base, opened.config);

        // Then - the declarations of the sources, nothing for the rest
        expect(
            ['a.d.ts', 'b.mts', 'c.cts', 'd.tsx', 'e.ts', 'f.ts.d.ts', 'g.ts'].map((name) =>
                shapeOf(program, join(project, 'src', name)),
            ),
        ).toStrictEqual([
            undefined,
            'export declare const b = 1;\n',
            'export declare const c = 1;\n',
            'export declare const d = 1;\n',
            'export declare const e = 1;\n',
            undefined,
            undefined,
        ]);
    });

    test('a project that emits declaration maps has them in the shape, after the declarations', () => {
        // Given - a project whose declarations come with a map
        const project = projectWith({
            'src/m.ts': 'export const m = 1;\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: {
                    declarationMap: true,
                    module: 'nodenext',
                    noEmit: true,
                    strict: true,
                    types: [],
                },
                include: ['src'],
            }),
        });
        const opened = nativeProject(project);
        expect(opened).toBeDefined();
        if (opened === undefined) {
            return;
        }
        onTestFinished(() => {
            opened.api.close();
        });

        // Then - the map follows the declarations with nothing between
        expect(shapeOf(programOf(opened.base, opened.config), join(project, 'src/m.ts'))).toMatch(
            /^export declare const m = 1;\n\/\/# sourceMappingURL=m\.d\.ts\.map\{"version":3/u,
        );
    });
});
