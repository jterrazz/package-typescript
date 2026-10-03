import { matchesGlob } from 'node:path';

// outside: npm ships these whatever `files` says.
const ALWAYS_PACKED = /^(?:package\.json|readme|license|licence|changelog)/iu;

export const withoutDotSlash = (target: string): string => target.replace(/^\.\//u, '');

function names(entry: string, path: string): boolean {
    const packed = withoutDotSlash(entry).replace(/\/$/u, '');

    return (
        path === packed ||
        path.startsWith(`${packed}/`) ||
        matchesGlob(path, packed) ||
        matchesGlob(path, `${packed}/**`)
    );
}

export function isPacked(files: readonly string[], target: string): boolean {
    const path = withoutDotSlash(target);
    if (files.length === 0 || ALWAYS_PACKED.test(path)) {
        return true;
    }

    let packed = false;
    for (const entry of files) {
        const negated = entry.startsWith('!');
        if (names(negated ? entry.slice(1) : entry, path)) {
            packed = !negated;
        }
    }

    return packed;
}
