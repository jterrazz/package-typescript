import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import {
    CHECKOUT,
    hoistedClosure,
    linkBins,
    linkFromCheckout,
    readManifest,
    runtimeDependencies,
} from '../../_shared/_setup/packed/closure.ts';

const project = process.cwd();
const installed = join(project, 'node_modules');

// outside: package-test packs itself into this checkout's install, so its folder is the tarball a consumer installs.
const PACKED = {
    '@jterrazz/test': join(CHECKOUT, 'node_modules/@jterrazz/test'),
    '@jterrazz/typescript': process.env.PACKED_PACKAGE ?? '',
};

const isFamily = (name: string): boolean => Object.hasOwn(PACKED, name);

function workspaceMembers(): string[] {
    const { workspaces } = readManifest(project);

    return (workspaces ?? []).flatMap((pattern) => {
        const parent = join(project, pattern.replace(/\/\*$/u, ''));
        return pattern.endsWith('/*') && existsSync(parent)
            ? readdirSync(parent).map((member) => join(parent, member))
            : [join(project, pattern)];
    });
}

function install(): void {
    for (const [name, packed] of Object.entries(PACKED)) {
        cpSync(packed, join(installed, name), { recursive: true });
    }
    const manifests = [project, ...workspaceMembers()].map((unit) => readManifest(unit));
    const declared = manifests.flatMap((manifest) =>
        runtimeDependencies(manifest).concat(Object.keys(manifest.devDependencies ?? {})),
    );
    const shipped = Object.values(PACKED).flatMap((packed) =>
        runtimeDependencies(readManifest(packed)),
    );
    for (const name of hoistedClosure([...shipped, ...declared].filter((one) => !isFamily(one)))) {
        linkFromCheckout(name, installed);
        linkBins(join(installed, name), installed);
    }
    linkBins(join(installed, '@jterrazz/typescript'), installed);
}

if (!existsSync(installed)) {
    install();
    spawnSync('git', ['init', '--quiet'], { cwd: project });
}

const [command = '', ...args] = process.argv.slice(2);
const run = spawnSync(command, args, {
    env: { ...process.env, PATH: [join(installed, '.bin'), process.env.PATH].join(delimiter) },
    stdio: 'inherit',
});
process.exitCode = run.status ?? 1;
