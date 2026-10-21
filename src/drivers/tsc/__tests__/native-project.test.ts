import type { Diagnostic } from '@typescript/native/sync';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { errorsOf, headline, nativeProject, programErrors, programOf } from '../native-project.js';

const diagnostic = (category: number): Diagnostic => ({
    category,
    code: 2322,
    end: 0,
    pos: 0,
    text: 'message',
});

describe('native-project', () => {
    test('errorsOf keeps the errors and leaves a warning, a suggestion and a message out', () => {
        // Given - one diagnostic of each category
        const all = [0, 1, 2, 3].map(diagnostic);

        // Then - only the error remains
        expect(errorsOf(all)).toStrictEqual([diagnostic(1)]);
    });

    test('headline names the file and line it is read from, and its code and message alone where it has no file or no position', () => {
        // Given - a diagnostic read from a broken file, then the same without its position, and without its file
        const project = mkdtempSync(join(tmpdir(), 'native-project-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        mkdirSync(join(project, 'src'));
        writeFileSync(
            join(project, 'src/a.ts'),
            "export const ok = 1;\nexport const a: number = 'one';\n",
        );
        writeFileSync(
            join(project, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: { noEmit: true, strict: true, types: [] },
                include: ['src'],
            }),
        );
        const opened = nativeProject(project);
        expect(opened).toBeDefined();
        if (opened === undefined) {
            return;
        }
        onTestFinished(() => {
            opened.base.dispose();
            opened.api.close();
        });
        const [placed] = programErrors(programOf(opened.base, opened.config));
        expect(placed).toBeDefined();
        if (placed === undefined) {
            return;
        }

        // Then - one-based line, path from the project
        const coded = "TS2322 Type 'string' is not assignable to type 'number'.";
        expect([
            headline(project, placed),
            headline(project, { ...placed, startPosition: undefined }),
            headline(project, { ...placed, fileName: undefined }),
        ]).toStrictEqual([`src/a.ts:2 ${coded}`, coded, coded]);
    });

    test('programOf names the configuration it found no project at', () => {
        // Given - a project opened on its own tsconfig.json
        const project = mkdtempSync(join(tmpdir(), 'native-project-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        writeFileSync(join(project, 'tsconfig.json'), '{}');
        const opened = nativeProject(project);
        expect(opened).toBeDefined();
        if (opened === undefined) {
            return;
        }
        onTestFinished(() => {
            opened.api.close();
        });

        // Then - another configuration holds no project
        expect(() => programOf(opened.base, join(project, 'other.json'))).toThrow(
            `the native compiler opened no project at ${join(project, 'other.json')}`,
        );
    });
});
