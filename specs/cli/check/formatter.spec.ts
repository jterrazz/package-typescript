import { file } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from 'node:process';
import { describe, expect, test } from 'vitest';

import { newDirectory, temporaryDirectory } from '../../__setup__/temporary-directory.js';
import { cli as oxfmtCli } from '../oxfmt.specification.js';

const BUILT_FROM = resolve(import.meta.dirname, '../../..');

// invariant: each probe targets one style decision the preset makes, never oxfmt's overall output.
const ENTRY = join(BUILT_FROM, 'dist/oxfmt.js');
const CONFIG_PATH = join(newDirectory('spec-formatter-config-'), 'oxfmt.config.mjs');
writeFileSync(
    CONFIG_PATH,
    `import { oxfmtConfig } from '${ENTRY}';\n\nexport default await oxfmtConfig(import.meta.url);\n`,
);
const OXFMT = resolve(import.meta.dirname, '../../../node_modules/.bin/oxfmt');

describe('formatter', () => {
    test('detects unformatted code', async () => {
        // Given - a file with wrong formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./__fixtures__/formatter/wrong-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the check fails
        expect(result.exitCode).toBe(1);
    });

    test('passes for properly formatted code', async () => {
        // Given - a file with correct formatting staged in the cwd
        const result = await oxfmtCli
            .fixture(file('./__fixtures__/formatter/correct-style.ts'))
            .exec(`--check --config ${CONFIG_PATH} correct-style.ts`);

        // Then - the check passes
        expect(result.exitCode).toBe(0);
    });

    // outside: the preset's ignores resolve against the config's directory, so the tree sits beside a config composing it.
    test('formats none of the asset trees, build caches and ground a project holds', () => {
        // Given - the same unformatted file at the root and under every tree the preset ignores, beside a consumer config
        const created = temporaryDirectory('spec-formatter-ignores-');
        cpSync(resolve(import.meta.dirname, '__fixtures__/formatter/asset-trees'), created, {
            recursive: true,
        });
        // invariant: a tracked `.next/` is the committed artefact the Gitignore pass refuses.
        mkdirSync(join(created, '.next'));
        cpSync(join(created, 'index.ts'), join(created, '.next/app.ts'));
        writeFileSync(
            join(created, 'oxfmt.config.ts'),
            `import { oxfmtConfig } from '${ENTRY}';\n\nexport default await oxfmtConfig(import.meta.url);\n`,
        );

        // When - oxfmt checks the whole tree

        // invariant: oxfmt colours its paths whenever `CI` is set, an empty value included, so the run states its own colour.
        const result = spawnSync(OXFMT, ['--check'], {
            cwd: created,
            encoding: 'utf8',
            env: { ...env, CI: undefined, NO_COLOR: '1' },
        });

        // Then - the root file alone is reported
        expect(result.status).toBe(1);
        expect(
            result.stdout
                .split('\n')
                .flatMap((line) => /^(?<path>\S+) \(\d+ms\)$/u.exec(line)?.groups?.path ?? []),
        ).toStrictEqual(['index.ts']);
    });

    test('formats unformatted code to the preset style', async () => {
        // Given - the wrong-style file formatted in place
        const result = await oxfmtCli
            .fixture(file('./__fixtures__/formatter/wrong-style.ts'))
            .exec(`--config ${CONFIG_PATH} wrong-style.ts`);

        // Then - the file is rewritten whole to the preset's quotes, semicolons and indentation
        expect(result.exitCode).toBe(0);
        expect(result.file('wrong-style.ts').content).toBe(
            readFileSync(
                resolve(import.meta.dirname, '__fixtures__/formatter/correct-style.ts'),
                'utf8',
            ),
        );
    });

    test('is idempotent when formatting already-correct code', async () => {
        // Given - an already-correct file formatted in place
        const result = await oxfmtCli
            .fixture(file('./__fixtures__/formatter/correct-style.ts'))
            .exec(`--config ${CONFIG_PATH} correct-style.ts`);

        // Then - the file is unchanged after formatting
        expect(result.exitCode).toBe(0);
        expect(result.file('correct-style.ts').content).toBe(
            readFileSync(
                resolve(import.meta.dirname, '__fixtures__/formatter/correct-style.ts'),
                'utf8',
            ),
        );
    });
});
