import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, test } from 'vitest';

import { emitterScript, scopedTsconfig, tsdownConfig, watchArguments } from '../tsdown.js';
import type { TsdownStep } from '../tsdown.js';

describe('tsdown', () => {
    test('watchArguments — watches the config and the project, and starts the application only when it is asked to', () => {
        // Given - the same config and project, asked to run the application and not
        const quiet = watchArguments('/tmp/tsdown.config.mjs', '/work/app', false);
        const running = watchArguments('/tmp/tsdown.config.mjs', '/work/app', true);

        // Then - both watch, in this order; only the second carries the command that starts the build
        expect([quiet, running]).toStrictEqual([
            ['--config', '/tmp/tsdown.config.mjs', '--cwd', '/work/app', '--watch'],
            [
                '--config',
                '/tmp/tsdown.config.mjs',
                '--cwd',
                '/work/app',
                '--watch',
                '--on-success',
                'node --enable-source-maps dist/index.js',
            ],
        ]);
    });

    test('emitterScript — runs the compiler on what the generator hands it, the scoped tsconfig last, each path read whole', () => {
        // Given - a compiler that prints its arguments, in a folder whose name holds a space and a quote
        const folder = mkdtempSync(join(tmpdir(), "emitter it's-"));
        const compiler = join(folder, 'tsc');
        writeFileSync(compiler, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
        const emitter = join(folder, 'emitter');
        writeFileSync(emitter, emitterScript(compiler, join(folder, 'tsconfig.0.json')), {
            mode: 0o755,
        });

        // When - the generator runs it as its compiler
        const printed = execFileSync(emitter, ['-p', '/work/lib/tsconfig.json', '--noCheck'], {
            encoding: 'utf8',
        });
        rmSync(folder, { force: true, recursive: true });

        // Then - its arguments reach the compiler unchanged, followed by the scoped tsconfig
        expect(printed.split('\n')).toStrictEqual([
            '-p',
            '/work/lib/tsconfig.json',
            '--noCheck',
            '-p',
            join(folder, 'tsconfig.0.json'),
            '',
        ]);
    });

    test("scopedTsconfig — extends the project's tsconfig over the step's entries alone, and writes no build info", () => {
        // Given - a step of two entries
        const scoped = scopedTsconfig('/work/lib', {
            index: 'src/index.ts',
            register: 'src/index.register.ts',
        });

        // Then - the project's options, those two files, nothing its include would add
        expect(scoped).toStrictEqual({
            compilerOptions: { incremental: false },
            extends: '/work/lib/tsconfig.json',
            files: ['/work/lib/src/index.ts', '/work/lib/src/index.register.ts'],
            include: [],
        });
    });

    test('tsdownConfig — hands each step to tsdown as planned, the generator of a step that declares logging its errors alone', () => {
        // Given - one step that emits declarations and one that emits none
        const step: Omit<TsdownStep, 'dts'> = {
            clean: true,
            entry: { index: 'src/index.ts' },
            fixedExtension: false,
            format: ['esm'],
            hash: false,
            outDir: 'dist',
            outputOptions: { chunkFileNames: 'shared-[name].js' },
            platform: 'node',
            sourcemap: true,
        };
        const declarations = {
            generator: 'tsgo',
            tsconfig: '/work/lib/tsconfig.json',
            tsgo: { path: '/work/lib/.artifacts/typescript-x/tsc.0' },
        } as const;
        const folder = mkdtempSync(join(tmpdir(), 'tsdown-config-'));
        const config = join(folder, 'tsdown.config.mjs');
        writeFileSync(
            config,
            tsdownConfig([
                { ...step, dts: declarations },
                { ...step, dts: false },
            ]),
        );

        // When - a process loads it as tsdown does, and the declaring step's generator logs once at each level
        const loaded = spawnSync(
            process.execPath,
            [
                '--input-type=module',
                '--eval',
                `const { default: steps } = await import(${JSON.stringify(config)});
const { logger, ...dts } = steps[0].dts;
logger.info('info'); logger.warn('warn'); logger.error('error');
process.stdout.write(JSON.stringify([{ ...steps[0], dts }, steps[1]]));`,
            ],
            { encoding: 'utf8' },
        );
        rmSync(folder, { force: true, recursive: true });

        // Then - the steps are the plan's, and only the error reached a stream
        const steps: unknown = JSON.parse(loaded.stdout);
        expect({ stderr: loaded.stderr, steps }).toStrictEqual({
            stderr: 'error\n',
            steps: [
                { ...step, dts: declarations },
                { ...step, dts: false },
            ],
        });
    });
});
