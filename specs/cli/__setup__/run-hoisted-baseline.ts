#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const PACKED = process.env.PACKED_PACKAGE ?? '';
const root = mkdtempSync(join(tmpdir(), 'hoisted-baseline-'));
const member = join(root, 'packages/api');
const installed = join(root, 'node_modules/@jterrazz/typescript');
const called = join(root, 'oxlint-called');

function stub(path: string, body: string): void {
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
}

// outside: npm hoists every tool to the workspace root, and the package itself keeps no `.bin` of its own.
cpSync(PACKED, installed, {
    filter: (source) => source !== join(PACKED, 'node_modules'),
    recursive: true,
});
mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
for (const tool of ['depcruise', 'ls-lint', 'oxfmt']) {
    stub(join(root, 'node_modules/.bin', tool), 'echo "{}"');
}
stub(
    join(root, 'node_modules/.bin/oxlint'),
    `echo "called" >> ${called}\necho '{ "diagnostics": [] }'`,
);
symlinkSync(
    resolve(import.meta.dirname, '../../../node_modules/typescript'),
    join(root, 'node_modules/typescript'),
);

mkdirSync(member, { recursive: true });
writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'hoisted', private: true, type: 'module', version: '1.0.0', workspaces: ['packages/*'] }, null, 4)}\n`,
);
writeFileSync(
    join(member, 'package.json'),
    `${JSON.stringify({ name: 'api', private: true, type: 'module', version: '1.0.0' }, null, 4)}\n`,
);
writeFileSync(
    join(member, 'jterrazz.config.ts'),
    "export default { kind: 'api', platform: 'node' };\n",
);
writeFileSync(
    join(member, 'oxlint.config.ts'),
    "import { oxlintConfig } from '@jterrazz/typescript/oxlint';\n\nexport default await oxlintConfig(import.meta.url);\n",
);
writeFileSync(
    join(member, 'tsconfig.json'),
    '{ "extends": "@jterrazz/typescript/tsconfig/node" }\n',
);
mkdirSync(join(member, 'src'));
writeFileSync(join(member, 'src/index.ts'), 'export const api = 1;\n');

spawnSync(process.execPath, [join(installed, 'dist/typescript.js'), 'baseline'], {
    cwd: member,
    env: { ...process.env, PATH: '/usr/bin:/bin' },
    stdio: 'ignore',
});
process.stdout.write(
    `oxlint resolved beside the workspace root: ${existsSync(called) ? 'yes' : 'no'}\n`,
);
rmSync(root, { force: true, recursive: true });
