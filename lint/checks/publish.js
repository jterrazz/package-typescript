#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';
import { argv, cwd, exit, stdout } from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import { buildOf, builtChunks, isPacked, withoutDotSlash } from '../reading/built-chunks.js';
import { testMaterialFindings, testMaterialReader } from './publish.material.js';

function targetsOf(exports) {
    if (typeof exports === 'string') {
        return [exports];
    }
    if (Array.isArray(exports)) {
        return exports.flatMap((entry) => targetsOf(entry));
    }
    if (exports !== null && typeof exports === 'object') {
        return Object.values(exports).flatMap((entry) => targetsOf(entry));
    }

    return [];
}

// A wildcard names a family: its directory must exist and hold something the pattern matches.
function resolvesOnDisk(root, target) {
    const path = withoutDotSlash(target);
    if (!path.includes('*')) {
        return existsSync(join(root, path));
    }

    const prefix = path.slice(0, path.indexOf('*'));
    const directory = prefix.endsWith('/') ? prefix.slice(0, -1) : dirname(prefix);
    try {
        return readdirSync(join(root, directory)).some((name) =>
            matchesGlob(join(directory, name), path),
        );
    } catch {
        return false;
    }
}

function runTool(name, binary, args, root) {
    const run = spawnSync(binary, args, { cwd: root, encoding: 'utf8' });
    if (run.error) {
        return { output: `${name} could not be run: ${run.error.message}\n`, status: 1 };
    }

    return { output: `${run.stdout ?? ''}${run.stderr ?? ''}`, status: run.status ?? 1 };
}

const flagged = (name, fallback) => {
    const at = argv.indexOf(name);

    return at === -1 || argv[at + 1] === undefined ? fallback : argv[at + 1];
};

const root = resolve(
    argv.slice(2).find((argument, index) => {
        const previous = argv[index + 1];

        return !argument.startsWith('--') && previous !== '--publint' && previous !== '--attw';
    }) ?? '.',
);

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const files = manifest.files ?? [];
const targets = [
    ...targetsOf(manifest.exports ?? {}),
    ...(manifest.main === undefined ? [] : [manifest.main]),
    ...(manifest.types === undefined ? [] : [manifest.types]),
];

let failed = false;

for (const target of [...new Set(targets)].toSorted((left, right) => (left < right ? -1 : 1))) {
    if (!resolvesOnDisk(root, target)) {
        stdout.write(
            `publish/export-target-exists  package.json  ${target} resolves to nothing on disk\n`,
        );
        failed = true;
        continue;
    }
    if (!isPacked(files, target)) {
        stdout.write(
            `publish/export-covered-by-files  package.json  ${target} is outside "files" — it resolves here and 404s in a consumer\n`,
        );
        failed = true;
    }
}

async function chunksOrFinding(build) {
    try {
        return { chunks: await builtChunks(root, build), line: null };
    } catch (error) {
        const reason =
            stripVTControlCharacters(error instanceof Error ? error.message : String(error))
                .split('\n')
                .map((line) => line.trim())
                .find((line) => line !== '' && !/^Build failed with \d+ errors?:$/u.test(line)) ??
            'tsdown gave no reason';

        return {
            chunks: null,
            line: `publish/build-succeeds  package.json  found: the build failed — ${reason} · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — its own tsdown.config, else \`typescript bundle\` · read: @jterrazz/typescript's docs/06-quality-checks.md#the-build-guard\n`,
        };
    }
}

const NOTHING_TO_JUDGE = {
    absent: () =>
        'no @jterrazz/test resolves from this package, and what test material is is its to say',
    readerless: () =>
        'the @jterrazz/test this package resolves publishes no reader of test material on `./oxlint` (17.0.0 and later do)',
    unloadable: ({ error }) =>
        `the @jterrazz/test this package resolves publishes a \`./oxlint\` entry that fails to load — ${error}`,
};

const member = relative(cwd(), root);

const build = buildOf(root, targets);
if (build !== null) {
    const loaded = await testMaterialReader(root);
    const reader = 'reader' in loaded ? loaded.reader : null;
    if (reader === null) {
        stdout.write(
            `publish/no-test-code-in-production: nothing to judge${member === '' ? '' : ` in ${member}`} — ${NOTHING_TO_JUDGE[loaded.reason](loaded)}\n`,
        );
    }
    const built = await chunksOrFinding(build);
    if (built.line !== null) {
        stdout.write(built.line);
        failed = true;
    }
    for (const { message, path, rule } of reader === null || built.chunks === null
        ? []
        : testMaterialFindings({ chunks: built.chunks, manifest, reader, root })) {
        stdout.write(`${rule}  ${path}  ${message}\n`);
        failed = true;
    }
}

for (const [name, binary, args] of [
    ['publint', flagged('--publint', 'publint'), ['--strict']],
    ['attw', flagged('--attw', 'attw'), ['--pack', '.', '--profile', 'esm-only']],
]) {
    const { output, status } = runTool(name, binary, args, root);
    if (status !== 0) {
        stdout.write(output);
        failed = true;
    }
}

exit(failed ? 1 : 0);
