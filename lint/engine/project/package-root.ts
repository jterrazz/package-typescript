import { existsSync } from 'node:fs';
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
