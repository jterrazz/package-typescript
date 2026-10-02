#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const PACKED = process.env.PACKED_PACKAGE ?? '';
const root = mkdtempSync(join(tmpdir(), 'split-install-'));
const installed = join(root, 'node_modules/@jterrazz/typescript');

function stub(path: string, body: string): void {
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
}

cpSync(PACKED, installed, {
    filter: (source) => source !== join(PACKED, 'node_modules'),
    recursive: true,
});
mkdirSync(join(installed, 'node_modules/.bin'), { recursive: true });
mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
for (const tool of ['tsc', 'oxfmt', 'knip']) {
    stub(join(root, 'node_modules/.bin', tool), `echo "${tool}-stub-ran"`);
}
stub(join(installed, 'node_modules/.bin/oxlint'), `echo '{ "diagnostics": [] }'`);

const run = spawnSync(process.execPath, [join(installed, 'dist/typescript.js'), 'check'], {
    cwd: root,
    stdio: 'inherit',
});
rmSync(root, { force: true, recursive: true });
process.exitCode = run.status ?? 1;
