#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import process from 'node:process';

/** A consumer's project as `npm install` leaves it, then the consumer's command: the spec laid the project's own files in the working directory; `node_modules/` gets the package unpacked from the tarball the run packed (`PACKED_PACKAGE`), its `bin` linked into `.bin/` as npm links it, and every other package the project installed beside it — this checkout's. */
const CHECKOUT = resolve(import.meta.dirname, '../../../..');

const checkoutModules = join(CHECKOUT, 'node_modules');
const installed = join(process.cwd(), 'node_modules');
const packed = process.env.PACKED_PACKAGE ?? '';

function installBeside(name: string): void {
    const target = join(installed, name);
    if (!existsSync(target)) {
        symlinkSync(join(checkoutModules, name), target);
    }
}

function install(): void {
    mkdirSync(join(installed, '.bin'), { recursive: true });
    mkdirSync(join(installed, '@jterrazz'), { recursive: true });
    symlinkSync(packed, join(installed, '@jterrazz', 'typescript'));
    for (const name of readdirSync(checkoutModules)) {
        if (name.startsWith('@')) {
            mkdirSync(join(installed, name), { recursive: true });
            for (const scoped of readdirSync(join(checkoutModules, name))) {
                installBeside(`${name}/${scoped}`);
            }
        } else if (!name.startsWith('.')) {
            installBeside(name);
        }
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `bin` is the one field npm links from
    const { bin = {} } = JSON.parse(readFileSync(join(packed, 'package.json'), 'utf8')) as {
        bin?: Record<string, string>;
    };
    for (const [name, target] of Object.entries(bin)) {
        symlinkSync(join('..', '@jterrazz', 'typescript', target), join(installed, '.bin', name));
    }
}

if (!existsSync(join(installed, '@jterrazz', 'typescript'))) {
    install();
}

const [command = '', ...args] = process.argv.slice(2);
const run = spawnSync(command, args, {
    env: {
        ...process.env,
        PATH: [join(installed, '.bin'), join(checkoutModules, '.bin'), process.env.PATH].join(
            delimiter,
        ),
    },
    stdio: 'inherit',
});
process.exitCode = run.status ?? 1;
