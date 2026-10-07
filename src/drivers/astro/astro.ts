import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';

import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';

const CHECKED = `${ARTIFACTS}/astro`;

// invariant: the TypeScript Check pass reports every `.ts` and `.tsx` file; `astro check` is handed a tsconfig whose root files are the templates alone, so a module's error is reported once, by tsc, while a template still type-checks against what it imports.
function templatesConfig(unit: string): string | undefined {
    if (!existsSync(join(unit, 'tsconfig.json'))) {
        return undefined;
    }
    mkdirSync(join(unit, CHECKED), { recursive: true });
    const path = join(CHECKED, 'tsconfig.json');
    writeFileSync(
        join(unit, path),
        `${JSON.stringify(
            {
                exclude: ['../../node_modules', '../../dist', '../../.artifacts'],
                extends: '../../tsconfig.json',
                include: ['../../**/*.astro', '../../.astro/types.d.ts'],
            },
            null,
            4,
        )}\n`,
    );

    return path;
}

/** Runs the unit's own `astro sync`, which writes the module types (`.astro/types.d.ts`) a fresh clone lacks, its report into `log`. */
export async function astroSynced(unit: string, log: string): Promise<number> {
    return await run(projectBinary('astro', unit), ['sync'], {
        cwd: unit,
        stderr: 'stdout',
        stdout: { append: true, path: log },
    });
}

/** Runs the unit's own `astro check` over its templates, once `astro sync` has run, its report appended to `log`. */
export async function astroChecked(unit: string, log: string): Promise<number> {
    const config = templatesConfig(unit);

    return await run(
        projectBinary('astro', unit),
        ['check', '--noSync', ...(config === undefined ? [] : ['--tsconfig', config])],
        { cwd: unit, stderr: 'stdout', stdout: { append: true, path: log } },
    );
}

const CONFIGS = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js', 'astro.config.mts'];

// outside: Astro loads an image service, an adapter's server or a renderer from the `entrypoint` string its config names, which knip's Astro plugin does not read.
const ENTRYPOINT = /\bentrypoint\s*:\s*['"`](?<path>\.{0,2}\/?[^'"`]+\.[cm]?[jt]sx?)['"`]/gu;

// Stryker disable next-line OptionalChaining: a match of the pattern always holds its named group
const pathOf = (match: RegExpExecArray): string => normalize(match.groups?.path ?? '');

/** The local modules the unit's Astro config loads by an `entrypoint` path, relative to the unit — a package's entrypoint is the package's to trace. */
export function astroEntrypointsOf(unit: string): string[] {
    const config = CONFIGS.find((name) => existsSync(join(unit, name)));
    if (config === undefined) {
        return [];
    }
    const text = readFileSync(join(unit, config), 'utf8');

    return [...text.matchAll(ENTRYPOINT)]
        .map((match) => pathOf(match))
        .filter((path) => !path.startsWith('..') && existsSync(join(unit, path)));
}
