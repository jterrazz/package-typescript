import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { entryPoints } from '../reading/entry-points.js';

// tsdown loads a package's own config in the preset's stead.
const OWN_CONFIG = /^tsdown\.config\.[cm]?[jt]s$/u;

const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

export function buildOf(root, targets, bundlePreset) {
    const own = readdirSync(root).find((name) => OWN_CONFIG.test(name));
    if (own !== undefined) {
        return { config: join(root, own), entry: undefined };
    }
    if (!targets.some((target) => BUILD_DIRECTORY.test(target))) {
        return null;
    }

    const entries = entryPoints(root);
    if (entries.length > 0) {
        return { config: bundlePreset, entry: entries };
    }

    return existsSync(join(root, 'src/index.ts'))
        ? { config: bundlePreset, entry: undefined }
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
                name: 'jterrazz-built-chunks',
            },
        ],
        publint: false,
        report: false,
        write: false,
    });

    return chunks.toSorted((left, right) => (left.file < right.file ? -1 : 1));
}
