import { accessSync, constants, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function nearestManifestDirectory(from: string): string {
    let directory = from;
    while (!existsSync(join(directory, 'package.json'))) {
        const parent = dirname(directory);
        if (parent === directory) {
            return from;
        }
        directory = parent;
    }

    return directory;
}

export const PACKAGE_ROOT = nearestManifestDirectory(import.meta.dirname);

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
