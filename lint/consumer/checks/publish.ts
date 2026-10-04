import { dirname, join, matchesGlob, relative } from 'node:path';
import { cwd } from 'node:process';
import { stripVTControlCharacters } from 'node:util';

import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import { buildPlanOf, buildSettingsOf } from '../../kit/project/build-plan.js';
import { buildOf, builtChunks } from '../../kit/project/built-chunks.js';
import type { Build, BuiltChunk } from '../../kit/project/built-chunks.js';
import { parsedObject, stringRecordOf, stringsOf } from '../../kit/project/json.js';
import { isPacked, withoutDotSlash } from '../../kit/project/packed-files.js';
import { testMaterialReader } from '../../kit/project/test-material.js';
import { noTestCodeInProductionFindings } from './publish.no-test-code-in-production.js';
import type { Manifest } from './publish.no-test-code-in-production.js';

function targetsOf(exports: unknown): string[] {
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

// invariant: a wildcard names a family: its directory must exist and hold something the pattern matches.
function resolvesOnDisk({ exists, list, root }: Context, target: string): boolean {
    const path = withoutDotSlash(target);
    if (!path.includes('*')) {
        return exists(join(root, path));
    }

    const prefix = path.slice(0, path.indexOf('*'));
    const directory = prefix.endsWith('/') ? prefix.slice(0, -1) : dirname(prefix);

    return (list(join(root, directory)) ?? []).some((name) =>
        matchesGlob(join(directory, name), path),
    );
}

async function chunksOrFinding(
    root: string,
    build: Build,
): Promise<{ chunks: BuiltChunk[] | null; finding: Finding | null }> {
    try {
        return { chunks: await builtChunks(root, build), finding: null };
    } catch (error) {
        const reason =
            stripVTControlCharacters(error instanceof Error ? error.message : String(error))
                .split('\n')
                .map((line) => line.trim())
                .find((line) => line !== '' && !/^Build failed with \d+ errors?:$/u.test(line)) ??
            'tsdown gave no reason';

        return {
            chunks: null,
            finding: {
                message: `found: the build failed — ${reason} · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — \`typescript build\` names what failed · read: @jterrazz/typescript's docs/reference/quality-checks.md#the-build-guard`,
                path: 'package.json',
                rule: 'publish/build-succeeds',
            },
        };
    }
}

const NOTHING_TO_JUDGE = {
    absent: (): string =>
        'no @jterrazz/test resolves from this package, and what test material is is its to say',
    unloadable: ({ error }: { error: string }): string =>
        `the @jterrazz/test this package resolves gives no reader of test material — ${error}`,
};

function exportFindings(
    context: Context,
    manifest: Manifest,
    targets: readonly string[],
): Finding[] {
    const findings: Finding[] = [];
    for (const target of [...new Set(targets)].toSorted((left, right) => (left < right ? -1 : 1))) {
        if (!resolvesOnDisk(context, target)) {
            findings.push({
                message: `${target} resolves to nothing on disk`,
                path: 'package.json',
                rule: 'publish/export-target-exists',
            });
        } else if (!isPacked(manifest.files ?? [], target)) {
            findings.push({
                message: `${target} is outside "files" — it resolves here and 404s in a consumer`,
                path: 'package.json',
                rule: 'publish/export-covered-by-files',
            });
        }
    }

    return findings;
}

async function buildFindings(
    context: Context,
    manifest: Manifest,
    build: Build,
): Promise<{ findings: Finding[]; lines: string[] }> {
    const { root } = context;
    const loaded = await testMaterialReader(root);
    const reader = 'reader' in loaded ? loaded.reader : null;
    const member = relative(cwd(), root);
    const why =
        'error' in loaded
            ? NOTHING_TO_JUDGE.unloadable(loaded)
            : 'reason' in loaded
              ? NOTHING_TO_JUDGE.absent()
              : '';
    const lines =
        reader === null
            ? [
                  `publish/no-test-code-in-production: nothing to judge${member === '' ? '' : ` in ${member}`} — ${why}`,
              ]
            : [];
    const built = await chunksOrFinding(root, build);
    const findings = built.finding === null ? [] : [built.finding];
    if (reader !== null && built.chunks !== null) {
        findings.push(
            ...noTestCodeInProductionFindings({ chunks: built.chunks, manifest, reader, root }),
        );
    }

    return { findings, lines };
}

function manifestOf(text: string): Manifest {
    const parsed = parsedObject(text);

    return {
        dependencies: stringRecordOf(parsed.dependencies),
        exports: parsed.exports,
        files: stringsOf(parsed.files),
        main: parsed.main,
        peerDependencies: stringRecordOf(parsed.peerDependencies),
        types: parsed.types,
    };
}

export const publish: Pass = Object.freeze({
    async check(context) {
        const manifest = manifestOf(context.read(join(context.root, 'package.json')) ?? '{}');
        const targets = [
            ...targetsOf(manifest.exports ?? {}),
            ...(typeof manifest.main === 'string' ? [manifest.main] : []),
            ...(typeof manifest.types === 'string' ? [manifest.types] : []),
        ];
        const { resolved } = await context.config();
        const { settings } = buildSettingsOf(resolved.sections.typescript);
        const build = buildOf(
            targets,
            buildPlanOf(context.root, {
                declaration: resolved.declaration,
                settings,
            }),
        );
        const built =
            build === null
                ? { findings: [], lines: [] }
                : await buildFindings(context, manifest, build);

        return {
            findings: [...exportFindings(context, manifest, targets), ...built.findings],
            lines: built.lines,
            tools: [
                { args: ['--strict'], flag: '--publint', name: 'publint' },
                ...(targets.length === 0
                    ? []
                    : [
                          {
                              args: ['--pack', '.', '--profile', 'esm-only'],
                              flag: '--attw',
                              name: 'attw',
                          },
                      ]),
            ],
        };
    },
    valued: ['--publint', '--attw'],
});
