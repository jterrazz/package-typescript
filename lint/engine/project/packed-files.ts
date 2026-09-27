import { matchesGlob } from 'node:path';

// npm ships these whatever `files` says.
const ALWAYS_PACKED = /^(?:package\.json|readme|license|licence|changelog)/iu;

export const withoutDotSlash = (target: string): string => target.replace(/^\.\//u, '');

export function isPacked(files: readonly string[], target: string): boolean {
    const path = withoutDotSlash(target);
    if (files.length === 0 || ALWAYS_PACKED.test(path)) {
        return true;
    }

    return files.some((entry) => {
        const packed = withoutDotSlash(entry).replace(/\/$/u, '');

        return (
            path === packed ||
            path.startsWith(`${packed}/`) ||
            matchesGlob(path, packed) ||
            matchesGlob(path, `${packed}/**`)
        );
    });
}
