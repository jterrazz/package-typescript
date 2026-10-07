import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import {
    hoistedClosure,
    linkBins,
    linkFromCheckout,
    readManifest,
    runtimeDependencies,
} from '../../../__setup__/packed/closure.ts';

const installed = join(process.cwd(), 'node_modules');
const packed = process.env.PACKED_PACKAGE ?? '';

function install(): void {
    cpSync(packed, join(installed, '@jterrazz', 'typescript'), { recursive: true });
    const project = readManifest(process.cwd());
    const own = [
        ...runtimeDependencies(project),
        ...Object.keys(project.devDependencies ?? {}),
    ].filter((name) => name !== '@jterrazz/typescript');
    const hoisted = hoistedClosure([...runtimeDependencies(readManifest(packed)), ...own]);
    for (const name of hoisted) {
        linkFromCheckout(name, installed);
        linkBins(join(installed, name), installed);
    }
    linkBins(join(installed, '@jterrazz', 'typescript'), installed);
}

if (!existsSync(join(installed, '@jterrazz', 'typescript'))) {
    install();
}

const [command = '', ...args] = process.argv.slice(2);
const run = spawnSync(command, args, {
    env: { ...process.env, PATH: [join(installed, '.bin'), process.env.PATH].join(delimiter) },
    stdio: 'inherit',
});
process.exitCode = run.status ?? 1;
