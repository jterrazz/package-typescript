/**
 * The Publish pass's build guard: no shipped file is compiled from test
 * material.
 *
 * What test material IS belongs to `@jterrazz/test` alone — the reader its F2
 * rule judges by, `materialAt` and `testPackageOf`, published on its
 * `./oxlint` entry. This module never holds a copy: it loads the reader from
 * the install the package itself resolves, else from the one the toolchain
 * reaches by name, and judges nothing where neither publishes it.
 *
 * The evidence is the build's module graph. The package is built as it
 * builds — its own `tsdown.config.*`, else the `bundle` preset over the
 * entries its `exports` map earns — with no chunk written, no `copy`, no
 * executable and no `onSuccess` command; a config's own `hooks` still run.
 * A plugin's `generateBundle` hook lists each chunk's module ids by the file
 * it lands in.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { entryPoints } from './entry-points.js';
import { resolveTestPackage } from './test-package.js';

/** The preset `typescript bundle` builds a library with. */
const BUNDLE_PRESET = join(import.meta.dirname, '../presets/tsdown/bundle.js');

/** A package's own build config, which tsdown would load in its stead. */
const OWN_CONFIG = /^tsdown\.config\.[cm]?[jt]s$/u;

/** The segment every installed module id passes through. */
const NODE_MODULES = `${sep}node_modules${sep}`;

/** Where the build lands, by the default tsdown and both presets share. */
const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

/** The file a condition tree points an importer at, `import` first — null when it names none. */
function importTarget(entry) {
    if (typeof entry === 'string') {
        return entry;
    }
    if (entry === null || typeof entry !== 'object') {
        return null;
    }
    for (const condition of ['import', 'default']) {
        const target = importTarget(entry[condition]);
        if (target !== null) {
            return target;
        }
    }

    return null;
}

/** The `./oxlint` entry of the install `root` resolves, as a URL — null when there is none. */
function projectToolEntry(root) {
    const resolved = resolveTestPackage(root);
    const target = importTarget(resolved?.manifest.exports?.['./oxlint']);
    if (resolved === null || target === null) {
        return null;
    }
    const entry = join(resolved.dir, target);

    return existsSync(entry) ? pathToFileURL(entry).href : null;
}

/** A module's two readers, or null when it publishes them not. */
function readerOf({ materialAt, testPackageOf }) {
    return typeof materialAt === 'function' && typeof testPackageOf === 'function'
        ? { materialAt, testPackageOf }
        : null;
}

/**
 * `@jterrazz/test`'s reader of test material: from the install `root`
 * resolves, else from the one the toolchain reaches by name — null when
 * neither publishes it.
 */
export async function testMaterialReader(root) {
    const entry = projectToolEntry(root);
    try {
        return readerOf(await import(entry ?? '@jterrazz/test/oxlint'));
    } catch {
        return null;
    }
}

/**
 * The build config the package builds with, and the entries handed to it —
 * or null when the package has no build: no config of its own, and no
 * published target under `dist/`.
 */
function buildOf(root, targets) {
    const own = readdirSync(root).find((name) => OWN_CONFIG.test(name));
    if (own !== undefined) {
        return { config: join(root, own), entry: undefined };
    }
    if (!targets.some((target) => BUILD_DIRECTORY.test(target))) {
        return null;
    }

    const entries = entryPoints(root);
    if (entries.length > 0) {
        return { config: BUNDLE_PRESET, entry: entries };
    }

    return existsSync(join(root, 'src/index.ts'))
        ? { config: BUNDLE_PRESET, entry: undefined }
        : null;
}

/**
 * Every chunk the package's build would write: its path from the package
 * root, the module ids compiled into it, and the specifiers it leaves to the
 * importer. Null when the package has no build. No chunk is written, and
 * the config's `copy`, `exe` and `onSuccess` are switched off.
 */
export async function builtChunks(root, targets) {
    const build = buildOf(root, targets);
    if (build === null) {
        return null;
    }

    const { build: tsdown } = await import('tsdown');
    /** @type {{ externals: string[], file: string, moduleIds: string[] }[]} */
    const chunks = [];
    await tsdown({
        attw: false,
        clean: false,
        config: build.config,
        copy: false,
        cwd: root,
        dts: false,
        ...(build.entry === undefined ? {} : { entry: build.entry }),
        exe: false,
        exports: false,
        logLevel: 'silent',
        onSuccess: false,
        plugins: [
            {
                generateBundle(options, bundle) {
                    const within = new Set(Object.keys(bundle));
                    const directory = options.dir ?? dirname(options.file);
                    for (const output of Object.values(bundle)) {
                        if (output.type !== 'chunk') {
                            continue;
                        }
                        chunks.push({
                            externals: [...output.imports, ...output.dynamicImports].filter(
                                (specifier) => !within.has(specifier),
                            ),
                            file: relative(root, join(directory, output.fileName)),
                            moduleIds: output.moduleIds,
                        });
                    }
                },
                name: 'jterrazz-publish-material',
            },
        ],
        publint: false,
        report: false,
        write: false,
    });

    return chunks.toSorted((left, right) => (left.file < right.file ? -1 : 1));
}

/** The package an installed module id belongs to — `vitest`, `@vitest/expect`. */
function installedPackageOf(id) {
    const below = id.slice(id.lastIndexOf(NODE_MODULES) + NODE_MODULES.length).split(sep);

    return below[0]?.startsWith('@') ? `${below[0]}/${below[1]}` : below[0];
}

/** Where a finding sends its reader: the row of the rule that owns the definition. */
const READ = "@jterrazz/test's docs/19-linting.md#f2-no-test-imports-in-prod";

/** What a finding on a module compiled in asks for. */
const CUT_THE_EDGE = 'cut the production edge F2 names, or take the module out of the entry';

/** One finding, in the four parts every finding of the family states. */
function finding(file, found, fix) {
    return {
        message: [
            `found: ${found}`,
            'why: a published build never carries test material',
            `fix: ${fix}`,
            `read: ${READ}`,
        ].join(' · '),
        path: file,
        rule: 'publish-test-material',
    };
}

/**
 * The findings a build's chunks earn, judged by `reader`. A module compiled
 * in is test material by `materialAt` when it is the package's own, by
 * `testPackageOf` when it is installed; a specifier left external is judged by
 * `testPackageOf` unless the package declares it to run in production.
 */
export function testMaterialFindings({ chunks, manifest, reader, root }) {
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    const findings = [];

    for (const { externals, file, moduleIds } of chunks) {
        for (const id of moduleIds.filter((candidate) => isAbsolute(candidate)).toSorted()) {
            if (id.includes(NODE_MODULES)) {
                const name = reader.testPackageOf(installedPackageOf(id));
                if (name !== undefined) {
                    findings.push(
                        finding(
                            file,
                            `${file} is compiled from ${name}, a test package`,
                            CUT_THE_EDGE,
                        ),
                    );
                }
                continue;
            }
            const kind = reader.materialAt(id);
            if (kind !== undefined) {
                findings.push(
                    finding(
                        file,
                        `${file} is compiled from ${relative(root, id)}, ${kind}`,
                        CUT_THE_EDGE,
                    ),
                );
            }
        }
        for (const specifier of externals.toSorted()) {
            const name = reader.testPackageOf(specifier);
            if (name !== undefined && !declared.has(name)) {
                findings.push(
                    finding(
                        file,
                        `${file} imports ${specifier}, a test package`,
                        `cut the import, or declare ${name} in "dependencies" when the product runs it`,
                    ),
                );
            }
        }
    }

    return findings;
}
