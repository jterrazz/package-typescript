#!/usr/bin/env node

/**
 * The layer map a project declared, checked against the graph it actually has.
 *
 * oxlint's `no-restricted-imports` reads a path and a pattern; dependency-
 * cruiser resolves the module graph, which is the only way to see a cycle that
 * runs through three files or an edge that hides behind a barrel. Where a
 * project declares a map — `.dependency-cruiser.cjs`, `.js` or `.mjs` at its
 * root — this gate is the one that reads it.
 *
 * The rule ids are the config's own `name`s. That is deliberate and it is the
 * only gate of this toolchain whose vocabulary the consumer writes: a layer map
 * is a project's own architecture, and naming its rules for it is the point.
 *
 * Usage: node check-architecture.js [root] [--depcruise <path>]
 *
 * dependency-cruiser's `err-long` report, verbatim, when the graph breaks the
 * map. Exit code: 0 when it holds, 1 otherwise. No `--fix`: moving a module
 * across a layer is a design decision.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The three spellings dependency-cruiser answers to at a project root. */
const CONFIGS = ['.dependency-cruiser.cjs', '.dependency-cruiser.js', '.dependency-cruiser.mjs'];

/**
 * What a cruise starts from. `src/` is the whole answer wherever there is one;
 * a workspace that keeps its code in `apps/` and `packages/` is cruised from
 * those instead, so a map never has to restate the tree's shape.
 */
const ROOTS = ['apps', 'lib', 'packages'];

const flagged = (name, fallback) => {
    const at = argv.indexOf(name);

    return at === -1 || argv[at + 1] === undefined ? fallback : argv[at + 1];
};

const root = resolve(
    argv.slice(2).find((argument, index) => {
        return !argument.startsWith('--') && argv[index + 1] !== '--depcruise';
    }) ?? '.',
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

/* An empty root is a cruise of nothing, and dependency-cruiser refuses one. */
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
