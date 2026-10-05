import { createRequire } from 'node:module';
import { join } from 'node:path';

import {
    binaryIn,
    HOISTED_BESIDE_PACKAGE,
    PACKAGE_ROOT,
} from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';

export const prettierBinary = (): string => binaryIn('prettier', HOISTED_BESIDE_PACKAGE);

/** The Astro plugin, resolved from this package: prettier resolves a plugin name from the consumer's directory, which declares none. */
export function prettierAstroPlugin(): string {
    try {
        return createRequire(join(PACKAGE_ROOT, 'package.json')).resolve('prettier-plugin-astro');
    } catch {
        return '';
    }
}

/** Checks, or writes, every `.astro` file under the unit, its report appended to `log`. */
export async function astroFormatted(
    { binary, plugin }: { binary: string; plugin: string },
    { fix, log, unit }: { fix: boolean; log: string; unit: string },
): Promise<number> {
    return await run(
        binary,
        [
            fix ? '--write' : '--check',
            '--config',
            join(PACKAGE_ROOT, 'src/presets/prettier/astro.json'),
            '--plugin',
            plugin,
            '--no-error-on-unmatched-pattern',
            '**/*.astro',
        ],
        { cwd: unit, stderr: 'stdout', stdout: { append: true, path: log } },
    );
}
