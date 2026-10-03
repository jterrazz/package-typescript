#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

const PACKED = process.env.PACKED_PACKAGE ?? '';

const root = mkdtempSync(join(tmpdir(), 'strict-install-'));
const store = join(root, 'node_modules/.pnpm/@jterrazz+typescript/node_modules');
const installed = join(store, '@jterrazz/typescript');

cpSync(PACKED, installed, {
    filter: (source) => source !== join(PACKED, 'node_modules'),
    recursive: true,
});
mkdirSync(join(store, '.bin'), { recursive: true });
mkdirSync(join(root, 'node_modules/@jterrazz'), { recursive: true });
mkdirSync(join(root, 'src'));
symlinkSync(installed, join(root, 'node_modules/@jterrazz/typescript'));

const manifest: unknown = JSON.parse(readFileSync(join(REPOSITORY, 'package.json'), 'utf8'));
const dependencies =
    typeof manifest === 'object' && manifest !== null && 'dependencies' in manifest
        ? Object.keys(manifest.dependencies ?? {})
        : [];
for (const dependency of dependencies.filter((name) =>
    existsSync(join(REPOSITORY, 'node_modules', name)),
)) {
    mkdirSync(dirname(join(store, dependency)), { recursive: true });
    symlinkSync(join(REPOSITORY, 'node_modules', dependency), join(store, dependency));
}
for (const binary of ['oxlint', 'oxfmt']) {
    symlinkSync(join(REPOSITORY, 'node_modules/.bin', binary), join(store, '.bin', binary));
}

writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ devDependencies: { '@jterrazz/typescript': '*' }, name: 'strict-consumer', type: 'module', version: '1.0.0' }, null, 4)}\n`,
);
writeFileSync(
    join(root, 'jterrazz.config.ts'),
    "export default { kind: 'api', platform: 'node' };\n",
);
writeFileSync(
    join(root, 'oxlint.config.ts'),
    "export { default } from '@jterrazz/typescript/oxlint';\n",
);
writeFileSync(
    join(root, 'oxfmt.config.ts'),
    "export { default } from '@jterrazz/typescript/oxfmt';\n",
);
writeFileSync(
    join(root, 'tsconfig.json'),
    `${JSON.stringify({ extends: '@jterrazz/typescript/tsconfig/node' }, null, 4)}\n`,
);
symlinkSync(join(REPOSITORY, 'node_modules/@types'), join(root, 'node_modules/@types'));
writeFileSync(join(root, 'src/index.ts'), 'export const answer = 42;\n');

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

function runHere(command: string, args: readonly string[]): number {
    return spawnSync(command, args, { cwd: root, stdio: 'inherit' }).status ?? 1;
}

function strictly(): number {
    for (const tool of ['oxlint', 'oxfmt']) {
        if (resolvesFrom(root, tool)) {
            process.stdout.write(`not a strict layout: ${tool} resolves from the consumer root\n`);

            return 1;
        }
        process.stdout.write(`unreachable from the consumer root: ${tool}\n`);
    }
    if (runHere(join(store, '.bin/oxlint'), ['--silent', 'src']) !== 0) {
        return 1;
    }
    process.stdout.write('loaded: oxlint.config.ts\n');
    if (runHere(join(store, '.bin/oxfmt'), ['--check', 'src']) !== 0) {
        return 1;
    }
    process.stdout.write('loaded: oxfmt.config.ts\n');

    return 0;
}

process.exitCode = strictly();
rmSync(root, { force: true, recursive: true });
