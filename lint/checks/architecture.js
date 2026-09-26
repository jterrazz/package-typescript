#!/usr/bin/env node

// The rule ids are the config's own `name`s: the one gate whose vocabulary the consumer writes.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

const CONFIGS = ['.dependency-cruiser.cjs', '.dependency-cruiser.js', '.dependency-cruiser.mjs'];

const ROOTS = ['apps', 'lib', 'packages'];

const flagged = (name, fallback) => {
    const at = argv.indexOf(name);

    return at === -1 || argv[at + 1] === undefined ? fallback : argv[at + 1];
};

const root = resolve(
    argv
        .slice(2)
        .find(
            (argument, index) => !argument.startsWith('--') && argv[index + 1] !== '--depcruise',
        ) ?? '.',
);

const config = CONFIGS.find((name) => existsSync(join(root, name)));
if (config === undefined) {
    exit(0);
}

const cruised = existsSync(join(root, 'src'))
    ? ['src']
    : ROOTS.filter((name) => existsSync(join(root, name)));

if (cruised.length === 0) {
    stdout.write(
        `${config} declares a layer map, but there is no src/, apps/, packages/ or lib/ to cruise\n`,
    );
    exit(1);
}

/* dependency-cruiser refuses a cruise of nothing. */
const populated = cruised.filter((name) => readdirSync(join(root, name)).length > 0);
if (populated.length === 0) {
    exit(0);
}

const run = spawnSync(
    flagged('--depcruise', 'depcruise'),
    ['--config', config, '--output-type', 'err-long', ...populated],
    { cwd: root, encoding: 'utf8' },
);

if (run.error) {
    stdout.write(`depcruise could not be run: ${run.error.message}\n`);
    exit(1);
}

if (run.status !== 0) {
    stdout.write(`${run.stdout ?? ''}${run.stderr ?? ''}`);
}

exit(run.status === 0 ? 0 : 1);
