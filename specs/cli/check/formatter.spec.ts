import { file } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { newDirectory, temporaryDirectory } from '../_setup/temporary-directory.js';
import { cli as oxfmtCli } from '../oxfmt.specification.js';

const BUILT_FROM = resolve(import.meta.dirname, '../../..');

// Each probe targets one style decision the preset makes, never oxfmt's overall output.
const ENTRY = join(BUILT_FROM, 'dist/oxfmt.js');
const CONFIG_PATH = join(newDirectory('spec-formatter-config-'), 'oxfmt.config.mjs');
writeFileSync(
    CONFIG_PATH,
    `import { oxfmtConfig } from '${ENTRY}';\n\nexport default await oxfmtConfig(import.meta.dirname);\n`,
);
const OXFMT = resolve(import.meta.dirname, '../../../node_modules/.bin/oxfmt');

type FormatResult = Awaited<ReturnType<typeof oxfmtCli.exec>>;

describe('formatter', () => {
    let formatted: FormatResult;

    beforeAll(async () => {
        formatted = await oxfmtCli
            .fixture(file('./_fixtures/formatter/wrong-style.ts'))
            .exec(`--config ${CONFIG_PATH} wrong-style.ts`);
    });

    test('detects unformatted code', async () => {
        // Given - a file with wrong formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./_fixtures/formatter/wrong-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the check fails
        expect(result.exitCode).toBe(1);
    });

    test('passes for properly formatted code', async () => {
        // Given - a file with correct formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./_fixtures/formatter/correct-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} correct-style.ts`);

        // Then - the check passes
        expect(result.exitCode).toBe(0);
    });

    // The preset's ignores resolve against the config's directory, so the tree sits beside a config composing it.
    test('formats none of the asset trees, build caches and ground a project holds', () => {
        // Given - the same unformatted file at the root and under every tree the preset ignores, beside a consumer config
        const created = temporaryDirectory('spec-formatter-ignores-');
        cpSync(resolve(import.meta.dirname, '_fixtures/formatter/asset-trees'), created, {
            recursive: true,
        });
        // A tracked `.next/` is the committed artefact the Gitignore pass refuses.
        mkdirSync(join(created, '.next'));
        cpSync(join(created, 'index.ts'), join(created, '.next/app.ts'));
        writeFileSync(
            join(created, 'oxfmt.config.ts'),
            `import { oxfmtConfig } from '${ENTRY}';\n\nexport default await oxfmtConfig(import.meta.dirname);\n`,
        );

        // When - oxfmt checks the whole tree
        const result = spawnSync(OXFMT, ['--check'], { cwd: created, encoding: 'utf8' });

        // Then - the root file alone is reported
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/^index\.ts /mu);
        for (const tree of [
            'public',
            'assets',
            '.next',
            '.expo',
            'dist',
            '_fixtures',
            '_expected',
            '_seeds',
            '_requests',
        ]) {
            expect(result.stdout).not.toContain(`${tree}/app.ts`);
        }
    });

    test('formats unformatted code correctly', async () => {
        // Given - the wrong-style file formatted in place
        const result = await oxfmtCli
            .fixture(file('./_fixtures/formatter/wrong-style.ts'))
            .exec(`--config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the file is rewritten with the correct style
        expect(result.exitCode).toBe(0);
        expect(result.file('wrong-style.ts').content).toContain("import fs from 'fs';");
        expect(result.file('wrong-style.ts').content).toContain(
            'function greet(name: string): string',
        );
        expect(result.file('wrong-style.ts').content).toMatch(/^\s{4}const/mu);
    });

    test('is idempotent when formatting already-correct code', async () => {
        // Given - an already-correct file formatted in place
        const result = await oxfmtCli
            .fixture(file('./_fixtures/formatter/correct-style.ts'))
            .exec(`--config ${CONFIG_PATH} correct-style.ts`);

        // Then - the file is unchanged after formatting
        expect(result.exitCode).toBe(0);
        const original = readFileSync(
            resolve(import.meta.dirname, '_fixtures/formatter/correct-style.ts'),
            'utf8',
        );
        expect(result.file('correct-style.ts').content).toContain(original.trim());
    });

    test('uses single quotes', () => {
        // Given - the formatted wrong-style file
        // Then - imports use single quotes
        expect(formatted.file('wrong-style.ts').content).toContain("'fs'");
    });

    test('uses semicolons', () => {
        // Given - the formatted wrong-style file
        // Then - statements end with semicolons
        expect(formatted.file('wrong-style.ts').content).toMatch(/;\s*$/mu);
    });

    test('uses four-space indentation', () => {
        // Given - the formatted wrong-style file
        // Then - indented lines use four spaces
        expect(formatted.file('wrong-style.ts').content).toMatch(/^\s{4}const/mu);
    });
});
