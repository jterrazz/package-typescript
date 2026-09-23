import { file } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, onTestFinished, test } from 'vitest';

import { cli as oxfmtCli } from '../oxfmt.specification.js';

/*
 * A chain, not a document: it drives the oxfmt binary (the B9w exception
 * oxfmt.specification.ts states) and `literate()` binds every document of this
 * repo to the product runner — and the claims below are regexes over a file's
 * content, where `files:` compares literal text.
 *
 * Scalpel by design: the formatted file content is oxfmt's (third-party) output —
 * our product is the PRESET, so each probe targets one style decision the preset
 * makes (quotes, semicolons, indentation), not oxfmt's overall formatting.
 */
const CONFIG_PATH = resolve(import.meta.dirname, '../../../src/presets/oxfmt/index.js');
const ENTRY = resolve(import.meta.dirname, '../../../src/oxfmt.js');
const OXFMT = resolve(import.meta.dirname, '../../../node_modules/.bin/oxfmt');

type FormatResult = Awaited<ReturnType<typeof oxfmtCli.exec>>;

describe('format checking', () => {
    test('detects unformatted code', async () => {
        // Given - a file with wrong formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./fixtures/formatter/wrong-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the check fails
        expect(result.exitCode).toBe(1);
    });

    test('passes for properly formatted code', async () => {
        // Given - a file with correct formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./fixtures/formatter/correct-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} correct-style.ts`);

        // Then - the check passes
        expect(result.exitCode).toBe(0);
    });
});

/*
 * The preset's ignores resolve against the CONFIG's directory, so they hold
 * only where a consumer's own config composes the preset at its root — the
 * way every project wires it — and never under `--config <preset>`. The tree
 * is copied beside such a config, which names this checkout's entry by path.
 */
describe('what the preset leaves alone', () => {
    test('formats none of the asset trees, build caches and ground a project holds', () => {
        // Given - the same unformatted file at the root and under every tree the preset ignores, beside a consumer config
        const created = mkdtempSync(resolve(tmpdir(), 'spec-formatter-ignores-'));
        onTestFinished(() => {
            rmSync(created, { force: true, recursive: true });
        });
        cpSync(resolve(import.meta.dirname, 'fixtures/formatter/asset-trees'), created, {
            recursive: true,
        });
        /* A tracked `.next/` is the committed artefact the Gitignore pass refuses, so it is made here. */
        mkdirSync(join(created, '.next'));
        cpSync(join(created, 'index.ts'), join(created, '.next/app.ts'));
        writeFileSync(
            join(created, 'oxfmt.config.ts'),
            `import { base, defineConfig } from '${ENTRY}';\n\nexport default defineConfig(base);\n`,
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
            'fixtures',
            'expected',
            'seeds',
            'requests',
        ]) {
            expect(result.stdout).not.toContain(`${tree}/app.ts`);
        }
    });
});

describe('format fixing', () => {
    test('formats unformatted code correctly', async () => {
        // Given - the wrong-style file formatted in place
        const result = await oxfmtCli
            .fixture(file('./fixtures/formatter/wrong-style.ts'))
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
            .fixture(file('./fixtures/formatter/correct-style.ts'))
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
            .fixture(file('./fixtures/formatter/wrong-style.ts'))
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
        expect(result.file('wrong-style.ts').content).toMatch(/;\s*$/mu);
    });

    test('uses four-space indentation', () => {
        // Given - the formatted wrong-style file
        // Then - indented lines use four spaces
        expect(result.file('wrong-style.ts').content).toMatch(/^\s{4}const/mu);
    });
});
