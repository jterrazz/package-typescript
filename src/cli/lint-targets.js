#!/usr/bin/env node

/**
 * The files oxlint and oxfmt are handed: the project's files every tree gate
 * starts from — cut to the source shapes a linter reads, or whole with
 * `--all` for the formatter, which skips a file it has no parser for.
 *
 * Handed the list rather than a directory, the linter and the formatter judge
 * exactly what every other tree gate judges: never the ground a test stands
 * on, never a path git ignores, whatever the tool's own walk would reach.
 *
 * Usage: node lint-targets.js [root] [--all] [--ignore-pattern <glob>]…
 *
 * One path per line, relative to the root. Exit code: 0 with the list —
 * empty when the project holds nothing the tool reads, which the caller reads
 * as nothing to lint or format — and 1 when the sweep itself refused an answer, which
 * the caller reads as "hand the tool the directory", so a gate never goes
 * silent on a sweep it could not make.
 */

import { resolve } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';

import { SOURCE } from './check-suppressions.js';
import { ignorePatternsOf, projectFiles } from './project-files.js';

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const every = argv.includes('--all');

try {
    const targets = projectFiles(root, { ignorePatterns: ignorePatternsOf(argv) }).filter(
        (path) => every || SOURCE.test(path),
    );
    stdout.write(targets.map((path) => `${path}\n`).join(''));
} catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    exit(1);
}
