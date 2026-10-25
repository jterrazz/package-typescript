import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { inScratch } from '../../../lint/kit/checker/ending.js';
import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import type { BuildStep } from '../../../lint/kit/project/build-plan.js';
import { binaryIn } from '../../../lint/kit/project/package-root.js';
import { handOver, run } from '../run.js';

type Declarations = { generator: 'tsgo'; tsconfig: string; tsgo: { path: string } };

export type TsdownStep = Omit<BuildStep, 'dts'> & { dts: Declarations | false };

function tsdown(project: string): string {
    return binaryIn('tsdown', join(project, 'node_modules/.bin'));
}

const quoted = (text: string): string => `'${text.replaceAll("'", String.raw`'\''`)}'`;

/** The script the declaration generator runs as its compiler: the compiler, on the project's own options over the step's entries alone. */
export function emitterScript(compiler: string, scoped: string): string {
    // outside: the generator hands the compiler the project's tsconfig with `-p`, and the compiler reads the last `-p` it is handed
    return `#!/bin/sh\nexec ${quoted(compiler)} "$@" -p ${quoted(scoped)}\n`;
}

/** The tsconfig a step's declarations are emitted by: the project's, over the files the step's entries import and no other. */
export const scopedTsconfig = (
    project: string,
    entry: Readonly<Record<string, string>>,
): Record<string, unknown> => ({
    compilerOptions: { incremental: false },
    extends: join(project, 'tsconfig.json'),
    files: Object.values(entry).map((source) => join(project, source)),
    include: [],
});

// invariant: the declarations are emitted by the compiler `check` type-checks with, from the project's options over what the step's entries import: emitting the whole tsconfig would emit, and refuse, the declarations of its tests.
function declared(
    steps: readonly BuildStep[],
    { compiler, project, scratch }: { compiler: string; project: string; scratch: string },
): TsdownStep[] {
    return steps.map((step, index) => {
        if (!step.dts) {
            return { ...step, dts: false };
        }
        const scoped = join(scratch, `tsconfig.${index}.json`);
        writeFileSync(scoped, `${JSON.stringify(scopedTsconfig(project, step.entry))}\n`);
        const emitter = join(scratch, `tsc.${index}`);
        writeFileSync(emitter, emitterScript(compiler, scoped), { mode: 0o755 });

        return {
            ...step,
            dts: {
                generator: 'tsgo',
                tsconfig: join(project, 'tsconfig.json'),
                tsgo: { path: emitter },
            },
        };
    });
}

// outside: the generator warns on every build that the native compiler's API is experimental, and logs nothing else; it is handed the compiler's command line, never that API, so its log is dropped.
const QUIET_GENERATOR = `const logger = { error: console.error, info() {}, warn() {} };\n`;

/** The config tsdown is handed: the steps, each one's declarations emitted by the compiler on its scoped tsconfig. */
export function tsdownConfig(steps: readonly TsdownStep[]): string {
    return `${QUIET_GENERATOR}const steps = ${JSON.stringify(steps, null, 4)};\nexport default steps.map((step) => (step.dts === false ? step : { ...step, dts: { ...step.dts, logger } }));\n`;
}

function written(
    steps: readonly BuildStep[],
    where: { compiler: string; project: string; scratch: string },
): string {
    const config = join(where.scratch, 'tsdown.config.mjs');
    writeFileSync(config, tsdownConfig(declared(steps, where)));

    return config;
}

// invariant: the scratch sits in the project, since the compiler resolves the packages a tsconfig names (`types`) from the directory of the tsconfig it reads.
async function inProjectScratch<T>(
    project: string,
    work: (scratch: string) => Promise<T>,
): Promise<T> {
    return await inScratch(work, join(project, ARTIFACTS));
}

export async function builtFrom(
    steps: readonly BuildStep[],
    project: string,
    compiler: string,
): Promise<number> {
    return await inProjectScratch(
        project,
        async (scratch) =>
            await run(tsdown(project), [
                '--config',
                written(steps, { compiler, project, scratch }),
                '--cwd',
                project,
            ]),
    );
}

/** The arguments tsdown watches with: the config, the project, and the command that starts the built application where `runs` says so. */
export const watchArguments = (config: string, project: string, runs: boolean): string[] => [
    '--config',
    config,
    '--cwd',
    project,
    '--watch',
    ...(runs ? ['--on-success', 'node --enable-source-maps dist/index.js'] : []),
];

/** Builds, and builds again on every change, until the process ends; the built application is run too when `run` is true. */
export async function watched(
    steps: readonly BuildStep[],
    project: string,
    { compiler, run: runs }: { compiler: string; run: boolean },
): Promise<number> {
    return await inProjectScratch(
        project,
        async (scratch) =>
            await handOver(
                tsdown(project),
                watchArguments(written(steps, { compiler, project, scratch }), project, runs),
                project,
            ),
    );
}
