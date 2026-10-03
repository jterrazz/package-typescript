#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

const PACKED = process.env.PACKED_PACKAGE ?? '';

const CONSUMERS = join(REPOSITORY, 'specs/cli/preset/_fixtures/install-matrix');
const ASTRO_PACKAGE = join(REPOSITORY, 'specs/cli/preset/_fixtures/astro-package');

const root = mkdtempSync(join(tmpdir(), 'install-matrix-'));

function resolvesFrom(directory: string, tool: string): boolean {
    const probe = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', `await import('${tool}')`],
        {
            cwd: directory,
            stdio: 'ignore',
        },
    );

    return probe.status === 0;
}

async function checked(runner: string, cwd: string): Promise<{ output: string; status: number }> {
    const child = spawn(process.execPath, [runner, 'check'], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
    }
    const closed: unknown[] = await once(child, 'close');
    const [code] = closed;

    return {
        output: Buffer.concat(chunks).toString('utf8'),
        status: typeof code === 'number' ? code : 1,
    };
}

function storeWith(directory: string, withAstro: boolean): string {
    const store = join(directory, '.pnpm/@jterrazz+typescript/node_modules');
    const installed = join(store, '@jterrazz/typescript');
    cpSync(PACKED, installed, {
        filter: (source) => source !== join(PACKED, 'node_modules'),
        recursive: true,
    });
    for (const name of readdirSync(join(REPOSITORY, 'node_modules'))) {
        const source = join(REPOSITORY, 'node_modules', name);
        if (name.startsWith('.') || name === '@jterrazz') {
            continue;
        }
        if (name.startsWith('@')) {
            mkdirSync(join(store, name), { recursive: true });
            for (const scoped of readdirSync(source)) {
                symlinkSync(join(source, scoped), join(store, name, scoped));
            }
        } else {
            symlinkSync(source, join(store, name));
        }
    }
    symlinkSync(join(REPOSITORY, 'node_modules/.bin'), join(store, '.bin'));
    if (withAstro) {
        symlinkSync(ASTRO_PACKAGE, join(store, 'astro'));
    }

    return installed;
}

function consumerOf(
    name: string,
    stores: { astro: string; plain: string },
): { name: string; project: string; runner: string } {
    const project = join(root, name);
    mkdirSync(join(project, 'node_modules/@jterrazz'), { recursive: true });
    cpSync(join(CONSUMERS, name), project, { recursive: true });
    const astro = readFileSync(join(project, 'package.json'), 'utf8').includes('"astro"');
    if (astro) {
        symlinkSync(ASTRO_PACKAGE, join(project, 'node_modules/astro'));
        mkdirSync(join(project, 'node_modules/.bin'), { recursive: true });
        symlinkSync(join(ASTRO_PACKAGE, 'bin/astro.js'), join(project, 'node_modules/.bin/astro'));
    }
    const installed = astro ? stores.astro : stores.plain;
    symlinkSync(installed, join(project, 'node_modules/@jterrazz/typescript'));
    mkdirSync(join(project, 'node_modules/@types'), { recursive: true });
    symlinkSync(
        join(REPOSITORY, 'node_modules/@types/node'),
        join(project, 'node_modules/@types/node'),
    );
    symlinkSync(join(REPOSITORY, 'node_modules/vitest'), join(project, 'node_modules/vitest'));

    return { name, project, runner: join(installed, 'dist/typescript.js') };
}

async function matrix(): Promise<number> {
    const stores = {
        astro: storeWith(join(root, 'astro-store'), true),
        plain: storeWith(join(root, 'store'), false),
    };
    const consumers = readdirSync(CONSUMERS).map((name) => consumerOf(name, stores));
    for (const { name, project } of consumers) {
        const loose = ['oxlint', 'oxfmt', 'knip'].find((tool) => resolvesFrom(project, tool));
        if (loose !== undefined) {
            process.stdout.write(
                `not a strict layout: ${loose} resolves from the ${name} consumer\n`,
            );

            return 1;
        }
    }
    const runs = await Promise.all(
        consumers.map(async ({ name, project, runner }) => {
            const { output, status } = await checked(runner, project);

            return { name, output, status };
        }),
    );
    for (const { name, output, status } of runs) {
        process.stdout.write(status === 0 ? `checked: ${name}\n` : `FAILED: ${name}\n${output}`);
    }

    return runs.every(({ status }) => status === 0) ? 0 : 1;
}

process.exitCode = await matrix();
rmSync(root, { force: true, recursive: true });
