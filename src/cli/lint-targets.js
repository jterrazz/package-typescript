#!/usr/bin/env node

// A tool handed a config by path resolves its `ignorePatterns` against the config's directory, where
// they reach nothing: `--ignores-of` leaves them out here. Exit 1 tells the caller to hand the directory.

import { resolve } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

import { SOURCE } from '../../lint/engine/project/comments.js';
import { ignorePatternsOf, projectFiles } from '../../lint/engine/project/project-files.js';

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const every = argv.includes('--all');
const handed = argv.includes('--ignores-of') ? argv[argv.indexOf('--ignores-of') + 1] : undefined;

try {
    const config =
        handed === undefined ? undefined : await import(pathToFileURL(resolve(handed)).href);
    const ignorePatterns = [...ignorePatternsOf(argv), ...(config?.default.ignorePatterns ?? [])];
    const targets = projectFiles(root, { ignorePatterns }).filter(
        (path) => every || SOURCE.test(path),
    );
    stdout.write(targets.map((path) => `${path}\n`).join(''));
} catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    exit(1);
}
