import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const UNSHIPPED = new Set(['lint/kit/testing', 'lint/self']);

export function shippedModules(root: string, directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return UNSHIPPED.has(relative(root, path)) ? [] : shippedModules(root, path);
        }
        return /\.[cm]?[jt]s$/u.test(entry.name) && !/\.(?:test|d)\.[cm]?[jt]s$/u.test(entry.name)
            ? [relative(root, path)]
            : [];
    });
}
