import { accessSync, constants, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { nearestRoot } from './repository-root.js';

export const PACKAGE_ROOT =
    nearestRoot(import.meta.dirname, (directory) => existsSync(join(directory, 'package.json'))) ??
    import.meta.dirname;

export function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);

        return true;
    } catch {
        return false;
    }
}

export function binaryIn(name: string, fallbackBin: string): string {
    return (
        [join(PACKAGE_ROOT, 'node_modules/.bin', name), join(fallbackBin, name)].find((path) =>
            isExecutable(path),
        ) ?? name
    );
}

export const HOISTED_BESIDE_PACKAGE = join(PACKAGE_ROOT, '../../.bin');

/** The project's own binary (the unit's, then the root's), else the one installed beside this package. */
export function projectBinary(name: string, unit = '.'): string {
    const local = [join(process.cwd(), unit), process.cwd()]
        .map((dir) => join(dir, 'node_modules/.bin', name))
        .find((path) => isExecutable(path));

    return local ?? binaryIn(name, HOISTED_BESIDE_PACKAGE);
}
