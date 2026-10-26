#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
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
for (const tool of ['tsc', 'oxfmt', 'knip', 'ls-lint']) {
    stub(join(root, 'node_modules/.bin', tool), `echo "${tool}-stub-ran"`);
}
stub(join(installed, 'node_modules/.bin/oxlint'), `echo '{ "diagnostics": [] }'`);
// outside: npm hoists the package's own dependencies a pass imports to the consumer root, beside the stubbed bins.
for (const hoisted of ['typescript', 'yaml']) {
    symlinkSync(
        resolve(import.meta.dirname, '../../../node_modules', hoisted),
        join(root, 'node_modules', hoisted),
    );
}

writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'split-consumer', private: true, type: 'module', version: '1.0.0' }, null, 4)}\n`,
);
writeFileSync(
    join(root, 'studio.config.ts'),
    "export default { kind: 'api', platform: 'node' };\n",
);
writeFileSync(
    join(root, 'oxlint.config.ts'),
    "import { oxlintConfig } from '@jterrazz/typescript/oxlint';\n\nexport default await oxlintConfig(import.meta.url);\n",
);
writeFileSync(
    join(root, 'oxfmt.config.ts'),
    "import { oxfmtConfig } from '@jterrazz/typescript/oxfmt';\n\nexport default await oxfmtConfig(import.meta.url);\n",
);
writeFileSync(join(root, 'tsconfig.json'), '{ "extends": "@jterrazz/typescript/tsconfig/node" }\n');

const run = spawnSync(process.execPath, [join(installed, 'dist/typescript.js'), 'check'], {
    cwd: root,
    stdio: 'inherit',
});
rmSync(root, { force: true, recursive: true });
process.exitCode = run.status ?? 1;
