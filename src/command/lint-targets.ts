// A tool handed a config by path resolves its `ignorePatterns` against the config's directory, where
// they reach nothing: `ignoresOf` leaves them out here. A throw tells the caller to hand the directory.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SOURCE } from '../../lint/engine/project/comments.js';
import { objectOf, stringsOf } from '../../lint/engine/project/json.js';
import { projectFiles } from '../../lint/engine/project/project-files.js';

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
