#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
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
const cruised = join(root, 'depcruise-cruised');
const NO_TOOL_ON_PATH = { ...process.env, PATH: '/usr/bin:/bin' };

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
for (const tool of ['ls-lint', 'oxfmt']) {
    stub(join(root, 'node_modules/.bin', tool), 'echo "{}"');
}
stub(
    join(root, 'node_modules/.bin/depcruise'),
    `for argument in "$@"; do [ "$previous" = --output-to ] && echo "{}" > "$argument"; previous="$argument"; done\npwd -P >> ${cruised}`,
);
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
    join(member, 'studio.config.ts'),
    `export default {
    kind: 'api',
    platform: 'node',
    typescript: {
        architecture: {
            layers: [
                {
                    name: 'domain-reaches-no-store',
                    from: { path: 'domain/' },
                    to: { path: 'infrastructure/' },
                    why: 'the member keeps its domain away from its stores',
                    fix: 'reach the store through the composition root',
                    read: 'docs/concepts/architecture.md#layers',
                },
            ],
        },
    },
};
`,
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

function ran(command: string, cwd: string): void {
    spawnSync(process.execPath, [join(installed, 'dist/typescript.js'), command], {
        cwd,
        env: NO_TOOL_ON_PATH,
        stdio: 'ignore',
    });
}

function cruisedTheMember(command: string): string {
    rmSync(cruised, { force: true });
    ran(command, root);
    const folders = existsSync(cruised) ? readFileSync(cruised, 'utf8').split('\n') : [];

    return folders.includes(realpathSync(member)) ? 'yes' : 'no';
}

ran('baseline', member);
process.stdout.write(
    `oxlint resolved beside the workspace root: ${existsSync(called) ? 'yes' : 'no'}\n`,
);
for (const command of ['baseline', 'check']) {
    process.stdout.write(
        `dependency-cruiser resolved beside the workspace root for a member's ${command}: ${cruisedTheMember(command)}\n`,
    );
}
rmSync(root, { force: true, recursive: true });
