// What test material IS belongs to `@jterrazz/test` alone: its reader is loaded from the install
// the package resolves, never copied here, and never from the toolchain's own install.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, matchesGlob, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { entryPoints } from '../reading/entry-points.js';
import { resolveTestPackage } from '../reading/test-package.js';

const BUNDLE_PRESET = join(import.meta.dirname, '../../src/presets/tsdown/bundle.js');

// tsdown loads a package's own config in the preset's stead.
const OWN_CONFIG = /^tsdown\.config\.[cm]?[jt]s$/u;

const NODE_MODULES = `${sep}node_modules${sep}`;

const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

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

function readerOf({ materialAt, testPackageOf }) {
    return typeof materialAt === 'function' && typeof testPackageOf === 'function'
        ? { materialAt, testPackageOf }
        : null;
}

/**
 * @returns {Promise<
 *     | { reader: { materialAt: (path: string) => string | undefined, testPackageOf: (specifier: string) => string | undefined } }
 *     | { reason: 'absent' | 'readerless' }
 *     | { error: string, reason: 'unloadable' }
 * >} the two readers, or why there are none
 */
export async function testMaterialReader(root) {
    const resolved = resolveTestPackage(root);
    if (resolved === null) {
        return { reason: 'absent' };
    }
    const target = importTarget(resolved.manifest.exports?.['./oxlint']);
    const entry = target === null ? null : join(resolved.dir, target);
    if (entry === null || !existsSync(entry)) {
        return { reason: 'readerless' };
    }
    let loaded;
    try {
        loaded = await import(pathToFileURL(entry).href);
    } catch (error) {
        return {
            error: (error instanceof Error ? error.message : String(error)).split('\n')[0],
            reason: 'unloadable',
        };
    }
    const reader = readerOf(loaded);

    return reader === null ? { reason: 'readerless' } : { reader };
}

export function buildOf(root, targets) {
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

// No chunk is written, and a config's `copy`, `exe` and `onSuccess` are switched off; its `hooks` still run.
export async function builtChunks(root, build) {
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

// npm ships these whatever `files` says.
const ALWAYS_PACKED = /^(?:package\.json|readme|license|licence|changelog)/iu;

export const withoutDotSlash = (target) => target.replace(/^\.\//u, '');

export function isPacked(files, target) {
    const path = withoutDotSlash(target);
    if (files.length === 0 || ALWAYS_PACKED.test(path)) {
        return true;
    }

    return files.some((entry) => {
        const packed = withoutDotSlash(entry).replace(/\/$/u, '');

        return (
            path === packed ||
            path.startsWith(`${packed}/`) ||
            matchesGlob(path, packed) ||
            matchesGlob(path, `${packed}/**`)
        );
    });
}

function installedPackageOf(id) {
    const below = id.slice(id.lastIndexOf(NODE_MODULES) + NODE_MODULES.length).split(sep);

    return below[0]?.startsWith('@') ? `${below[0]}/${below[1]}` : below[0];
}

const READ = "@jterrazz/test's docs/19-linting.md#f2-no-test-imports-in-prod";

const CUT_THE_EDGE = 'cut the production edge F2 names, or take the module out of the entry';

function finding(file, found, fix) {
    return {
        message: [
            `found: ${found}`,
            'why: a published build never carries test material',
            `fix: ${fix}`,
            `read: ${READ}`,
        ].join(' · '),
        path: file,
        rule: 'publish/no-test-code-in-production',
    };
}

// An external specifier is judged by `testPackageOf` unless the package declares it to run in production.
export function testMaterialFindings({ chunks, manifest, reader, root }) {
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    const findings = [];

    const shipped = chunks.filter(({ file }) => isPacked(manifest.files ?? [], file));
    for (const { externals, file, moduleIds } of shipped) {
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
