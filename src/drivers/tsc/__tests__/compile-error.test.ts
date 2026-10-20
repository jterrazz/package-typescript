import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { firstCompileError } from '../compile-error.js';

const TSCONFIG = JSON.stringify({
    compilerOptions: {
        module: 'nodenext',
        noEmit: true,
        strict: true,
        target: 'es2022',
        types: [],
    },
    include: ['src'],
});

function projectWith(files: Readonly<Record<string, string>>): string {
    const project = mkdtempSync(join(tmpdir(), 'compile-error-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    mkdirSync(join(project, 'src'));
    for (const [name, text] of Object.entries(files)) {
        writeFileSync(join(project, name), text);
    }

    return project;
}

describe('compile-error', () => {
    test('names the first error of the tree at its file and line, its code and its message; nothing where the tree compiles', () => {
        // Given - a tree whose second file assigns a string to a number on its second line, and the same tree fixed
        const broken = projectWith({
            'src/a.ts': 'export const a: number = 1;\n',
            'src/b.ts': "export const b = 1;\nexport const c: number = 'one';\n",
            'tsconfig.json': TSCONFIG,
        });
        const fixed = projectWith({
            'src/a.ts': 'export const a: number = 1;\n',
            'tsconfig.json': TSCONFIG,
        });

        // Then - the broken tree's first error, read relative to the project; the fixed one has none
        expect([firstCompileError(broken), firstCompileError(fixed)]).toStrictEqual([
            "src/b.ts:2 TS2322 Type 'string' is not assignable to type 'number'.",
            undefined,
        ]);
    });

    test('a project with no tsconfig.json has none; an option the compiler does not know, and a type it cannot find, are each the first error', () => {
        // Given - a project with no tsconfig.json, one naming an unknown option, and one naming a type no package declares
        const missing = projectWith({ 'src/a.ts': 'export const a = 1;\n' });
        const unknown = projectWith({
            'src/a.ts': 'export const a = 1;\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: { unknownOption: true },
                include: ['src'],
            }),
        });
        const untyped = projectWith({
            'src/a.ts': 'export const a = 1;\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: { types: ['absent'] },
                include: ['src'],
            }),
        });

        // Then - nothing where no tsconfig.json is kept; the others in the compiler's words, an error of no file by its code and message alone
        expect([
            firstCompileError(missing),
            firstCompileError(unknown),
            firstCompileError(untyped),
        ]).toStrictEqual([
            undefined,
            "tsconfig.json:1 TS5023 Unknown compiler option 'unknownOption'.",
            "TS2688 Cannot find type definition file for 'absent'.",
        ]);
    });
});
