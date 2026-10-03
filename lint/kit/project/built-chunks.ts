import { dirname, join, relative } from 'node:path';

import { DIST } from './build-plan.js';
import type { BuildStep } from './build-plan.js';

const BUILD_DIRECTORY = /^(?:\.\/)?dist\//u;

export type Build = { steps: readonly BuildStep[] };

export type BuiltChunk = { externals: string[]; file: string; moduleIds: string[] };

export const buildOf = (targets: readonly string[], steps: readonly BuildStep[]): Build | null =>
    targets.some((target) => BUILD_DIRECTORY.test(target)) && steps.length > 0 ? { steps } : null;

export async function builtChunks(root: string, build: Build): Promise<BuiltChunk[]> {
    const { build: tsdown } = await import('tsdown');
    const chunks: BuiltChunk[] = [];
    for (const step of build.steps.filter(({ outDir }) => outDir === DIST)) {
        // oxlint-disable-next-line no-await-in-loop -- one tsdown run at a time keeps its logger and its chunks apart
        await tsdown({
            ...step,
            attw: false,
            clean: false,
            config: false,
            copy: [],
            cwd: root,
            dts: false,
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
    }

    return chunks.toSorted((left, right) => (left.file < right.file ? -1 : 1));
}
