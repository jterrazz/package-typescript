import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { DEFAULT_ENTRY, DEFAULT_SOURCE, entryPoints } from './entry-points.js';

// tsdown loads a package's own config in the preset's stead.
const OWN_CONFIG = /^tsdown\.config\.[cm]?[jt]s$/u;

const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

export type Build = { config: string; entry: Readonly<Record<string, string>> | undefined };

export type BuiltChunk = { externals: string[]; file: string; moduleIds: string[] };

export function buildOf(
    root: string,
    targets: readonly string[],
    bundlePreset: string,
): Build | null {
    const own = readdirSync(root).find((name) => OWN_CONFIG.test(name));
    if (own !== undefined) {
        return { config: join(root, own), entry: undefined };
    }
    if (!targets.some((target) => BUILD_DIRECTORY.test(target))) {
        return null;
    }

    const entries = entryPoints(root);
    if (Object.keys(entries).length > 0) {
        return { config: bundlePreset, entry: entries };
    }

    return existsSync(join(root, DEFAULT_SOURCE))
        ? { config: bundlePreset, entry: DEFAULT_ENTRY }
        : null;
}

// No chunk is written, and a config's `copy`, `exe` and `onSuccess` are switched off; its `hooks` still run.
export async function builtChunks(root: string, build: Build): Promise<BuiltChunk[]> {
    const { build: tsdown } = await import('tsdown');
    const chunks: BuiltChunk[] = [];
    await tsdown({
        attw: false,
        clean: false,
        config: build.config,
        copy: [],
        cwd: root,
        dts: false,
        ...(build.entry === undefined ? {} : { entry: build.entry }),
        exe: false,
        exports: false,
        logLevel: 'silent',
        onSuccess: (): void => undefined,
        plugins: [
            {
                generateBundle(options, bundle) {
                    const within = new Set(Object.keys(bundle));
                    const directory = options.dir ?? dirname(options.file ?? root);
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
