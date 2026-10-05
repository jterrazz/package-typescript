import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SOURCE } from './comments.js';
import { objectOf, stringsOf } from './json.js';
import { projectFiles } from './project-files.js';

export async function lintTargets(
    root: string,
    {
        every = false,
        ignorePatterns,
        ignoresOf,
    }: { every?: boolean; ignorePatterns: readonly string[]; ignoresOf?: string | undefined },
): Promise<string[]> {
    const config: unknown =
        ignoresOf === undefined ? undefined : await import(pathToFileURL(resolve(ignoresOf)).href);
    const patterns = [
        ...ignorePatterns,
        ...stringsOf(objectOf(objectOf(config).default).ignorePatterns),
    ];

    return projectFiles(resolve(root), { ignorePatterns: patterns }).filter(
        (path) => every || SOURCE.test(path),
    );
}
