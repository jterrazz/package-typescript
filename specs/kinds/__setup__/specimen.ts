import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import process from 'node:process';

import {
    CHECKOUT,
    hoistedClosure,
    linkBins,
    linkFromCheckout,
    readManifest,
    runtimeDependencies,
} from '../../__setup__/packed/closure.ts';

const project = process.cwd();
const installed = join(project, 'node_modules');

// outside: package-test packs itself into this checkout's install, so its folder is the tarball a consumer installs.
const PACKED = {
    '@jterrazz/test': join(CHECKOUT, 'node_modules/@jterrazz/test'),
    '@jterrazz/typescript': process.env.PACKED_PACKAGE ?? '',
};

// outside: the checkout installs no Bun and no Astro, so a specimen declaring either is handed the stand-in the toolchain's own specs use: Bun's types as one declaration, Astro as its tsconfigs and a binary that refuses nothing.
const STAND_INS: Record<string, string> = {
    '@types/bun': resolve(import.meta.dirname, '../../__fixtures__/bun-types'),
    astro: resolve(import.meta.dirname, '../../__fixtures__/astro-package'),
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
    for (const name of declared.filter((one) => Object.hasOwn(STAND_INS, one))) {
        mkdirSync(dirname(join(installed, name)), { recursive: true });
        symlinkSync(STAND_INS[name] ?? '', join(installed, name));
        linkBins(join(installed, name), installed);
    }
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
