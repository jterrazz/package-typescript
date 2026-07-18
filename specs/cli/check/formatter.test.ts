import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { cli as oxfmtCli } from '../oxfmt.specification.js';

/*
 * Scalpel by design: the formatted file content is oxfmt's (third-party) output —
 * our product is the PRESET, so each probe targets one style decision the preset
 * makes (quotes, semicolons, indentation), not oxfmt's overall formatting.
 */
const CONFIG_PATH = resolve(import.meta.dirname, '../../../presets/oxfmt/index.js');

type FormatResult = Awaited<ReturnType<typeof oxfmtCli.exec>>;

describe('format checking', () => {
    test('detects unformatted code', async () => {
        // Given - a file with wrong formatting staged in the cwd
        const result = await oxfmtCli
            .fixture('formatter/wrong-style.ts')
            .exec(`--check --config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the check fails
        expect(result.exitCode).toBe(1);
    });

    test('passes for properly formatted code', async () => {
        // Given - a file with correct formatting staged in the cwd
        const result = await oxfmtCli
            .fixture('formatter/correct-style.ts')
            .exec(`--check --config ${CONFIG_PATH} correct-style.ts`);

        // Then - the check passes
        expect(result.exitCode).toBe(0);
    });
});

describe('format fixing', () => {
    test('formats unformatted code correctly', async () => {
        // Given - the wrong-style file formatted in place
        const result = await oxfmtCli
            .fixture('formatter/wrong-style.ts')
            .exec(`--config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the file is rewritten with the correct style
        expect(result.exitCode).toBe(0);
        expect(result.file('wrong-style.ts').content).toContain("import fs from 'fs';");
        expect(result.file('wrong-style.ts').content).toContain(
            'function greet(name: string): string',
        );
        expect(result.file('wrong-style.ts').content).toMatch(/^\s{4}const/m);
    });

    test('is idempotent when formatting already-correct code', async () => {
        // Given - an already-correct file formatted in place
        const result = await oxfmtCli
            .fixture('formatter/correct-style.ts')
            .exec(`--config ${CONFIG_PATH} correct-style.ts`);

        // Then - the file is unchanged after formatting
        expect(result.exitCode).toBe(0);
        const original = readFileSync(
            resolve(import.meta.dirname, 'fixtures/formatter/correct-style.ts'),
            'utf8',
        );
        expect(result.file('correct-style.ts').content).toContain(original.trim());
    });
});

describe('config options', () => {
    let result: FormatResult;

    beforeAll(async () => {
        // Format the wrong-style file so the applied style options can be inspected.
        result = await oxfmtCli
            .fixture('formatter/wrong-style.ts')
            .exec(`--config ${CONFIG_PATH} wrong-style.ts`);
    });

    test('uses single quotes', () => {
        // Given - the formatted wrong-style file
        // Then - imports use single quotes
        expect(result.file('wrong-style.ts').content).toContain("'fs'");
    });

    test('uses semicolons', () => {
        // Given - the formatted wrong-style file
        // Then - statements end with semicolons
        expect(result.file('wrong-style.ts').content).toMatch(/;\s*$/m);
    });

    test('uses four-space indentation', () => {
        // Given - the formatted wrong-style file
        // Then - indented lines use four spaces
        expect(result.file('wrong-style.ts').content).toMatch(/^\s{4}const/m);
    });
});
