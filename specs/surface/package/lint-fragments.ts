import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Every fragment a `lint/` tree declares: the default export of each of its
 * `.js` modules that holds decisions, whether a profile carries it or not.
 * The tree is this checkout's or a packed one, named by its package root.
 */

/** A fragment a module exports by default, and that module's path from the package root. */
export type DeclaredFragment = {
    fragment: Record<string, unknown>;
    path: string;
};

/** Whether a value is an object whose keys can be read. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Every `.js` module under `directory`, as a path from `root`. */
function modulesUnder(root: string, directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return modulesUnder(root, path);
        }
        return entry.name.endsWith('.js') ? [relative(root, path)] : [];
    });
}

/** The fragments the `lint/` under `root` declares, each module imported once. */
export async function lintFragments(root: string): Promise<DeclaredFragment[]> {
    const modules = modulesUnder(root, join(root, 'lint'));
    const declared = await Promise.all(
        modules.map(async (path) => {
            const module: unknown = await import(pathToFileURL(join(root, path)).href);
            const exported = isRecord(module) ? module.default : undefined;

            return isRecord(exported) && 'decisions' in exported
                ? [{ fragment: exported, path }]
                : [];
        }),
    );

    return declared.flat();
}
