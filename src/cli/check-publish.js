#!/usr/bin/env node

/**
 * What a published package promises, held to what the tarball will contain.
 *
 * Every mistake this gate refuses is invisible in the repository and fatal in
 * the registry: an `exports` entry pointing at a file nobody built, a subpath
 * left out of `files` so it resolves in development and 404s in a consumer, a
 * type declaration a modern resolver cannot see. The two tools that know those
 * failure modes best run here — `publint` on the packed tarball, and
 * `@arethetypeswrong/cli` on the declarations — beside the two joins only the
 * source tree can answer, and the build guard: no shipped file is compiled
 * from test material ([publish-material.js](publish-material.js)).
 *
 * Usage: node check-publish.js [root] [--publint <path>] [--attw <path>]
 *
 * One line per violation of this gate's own rules, `<rule>  <path>
 * <message>`; each tool's own report is printed verbatim under its name when it
 * refuses. A package with a build but no reader of test material gets one
 * line saying why, passing or not; its build still runs. Exit code: 0 when the package is publishable, 1
 * otherwise. No `--fix`: an exports map is a contract, not a formatting choice.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import {
    buildOf,
    builtChunks,
    isPacked,
    plain,
    testMaterialFindings,
    testMaterialReader,
} from './publish-material.js';

/** Every string an exports map points at, wherever the conditions nest. */
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

/**
 * Whether a target resolves on disk. A wildcard names a family rather than a
 * file, so what is asked of it is that the directory it reads from exists and
 * holds something the pattern matches.
 */
function resolvesOnDisk(root, target) {
    const path = plain(target);
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

/** One tool's verdict, with its report kept for the failing case. */
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
            `publish-exports-target  package.json  ${target} resolves to nothing on disk\n`,
        );
        failed = true;
        continue;
    }
    if (!isPacked(files, target)) {
        stdout.write(
            `publish-files  package.json  ${target} is outside "files" — it resolves here and 404s in a consumer\n`,
        );
        failed = true;
    }
}

/** The build's chunks, or the one line a build that fails earns in their stead. */
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
            line: `publish-build  package.json  found: the build failed — ${reason} · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — its own tsdown.config, else \`typescript bundle\` · read: @jterrazz/typescript's docs/06-quality-checks.md#the-build-guard\n`,
        };
    }
}

/** Why the build guard has nothing to judge, said on a passing run too. */
const NOTHING_TO_JUDGE = {
    absent: () =>
        'no @jterrazz/test resolves from this package, and what test material is is its to say',
    readerless: () =>
        'the @jterrazz/test this package resolves publishes no reader of test material on `./oxlint` (17.0.0 and later do)',
    unloadable: ({ error }) =>
        `the @jterrazz/test this package resolves publishes a \`./oxlint\` entry that fails to load — ${error}`,
};

const build = buildOf(root, targets);
if (build !== null) {
    const loaded = await testMaterialReader(root);
    const reader = 'reader' in loaded ? loaded.reader : null;
    if (reader === null) {
        stdout.write(
            `publish-test-material: nothing to judge — ${NOTHING_TO_JUDGE[loaded.reason](loaded)}\n`,
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
