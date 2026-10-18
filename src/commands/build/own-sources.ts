import { existsSync } from 'node:fs';
import type { ResolveHookSync } from 'node:module';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { manifestAt } from '../../../lint/kit/project/build-steps.js';
import { ENTRY_ROOTS, subpathStemOf } from '../../../lint/kit/project/entry-points.js';
import { objectOf, textOf } from '../../../lint/kit/project/json.js';
import { withoutDotSlash } from '../../../lint/kit/project/packed-files.js';

const COMPILED = /\.js$/u;

/** The source each subpath of the package's exports map is built from, by the entry grammar, keyed by the specifier that imports it under the package's own name. */
export function ownSourcesOf(root: string): ReadonlyMap<string, string> {
    const manifest = manifestAt(root);
    const name = textOf(manifest.name);
    const sources = new Map<string, string>();
    for (const subpath of Object.keys(objectOf(manifest.exports))) {
        const stem = subpathStemOf(subpath, false);
        const source = ENTRY_ROOTS.map((folder) => join(root, folder, `${stem}.ts`)).find(
            (candidate) => existsSync(candidate),
        );
        if (source !== undefined) {
            sources.set(subpath === '.' ? name : `${name}/${withoutDotSlash(subpath)}`, source);
        }
    }

    return sources;
}

function isOwnSource(root: string, parent: string | undefined): parent is string {
    if (parent?.startsWith('file:') !== true) {
        return false;
    }
    const path = fileURLToPath(parent);

    return (
        path.startsWith(`${root}${sep}`) &&
        path.endsWith('.ts') &&
        !path.includes(`${sep}node_modules${sep}`)
    );
}

/** Resolves the package's own name to its sources, and a source's import of a `.js` no disk holds to the `.ts` beside it, so a settings file that loads the presets the package ships loads them before any build of it exists. */
export function fromOwnSources(root: string): ResolveHookSync {
    const own = ownSourcesOf(root);

    return (specifier, context, nextResolve) => {
        const source = own.get(specifier);
        if (source !== undefined) {
            return { shortCircuit: true, url: pathToFileURL(source).href };
        }
        const parent = context.parentURL;
        if (specifier.startsWith('.') && isOwnSource(root, parent)) {
            const written = new URL(specifier.replace(COMPILED, '.ts'), parent);
            if (!existsSync(new URL(specifier, parent)) && existsSync(written)) {
                return { shortCircuit: true, url: written.href };
            }
        }

        return nextResolve(specifier, context);
    };
}
