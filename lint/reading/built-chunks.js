import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, matchesGlob, relative } from 'node:path';

import { entryPoints } from './entry-points.js';

const BUNDLE_PRESET = join(import.meta.dirname, '../../src/presets/tsdown/bundle.js');

// tsdown loads a package's own config in the preset's stead.
const OWN_CONFIG = /^tsdown\.config\.[cm]?[jt]s$/u;

const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

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
