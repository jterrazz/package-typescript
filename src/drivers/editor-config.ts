import { join } from 'node:path';
import process from 'node:process';

import { isFileOnDisk } from '../../lint/kit/project/fs-cache.js';
import { PACKAGE_ROOT } from '../../lint/kit/project/package-root.js';

export type ToolConfig = {
    args: string[];
    ignoresOf: string | undefined;
    own: string | undefined;
    path: string;
};

/** The config an editor tool runs with: the project's own, under the first name it keeps, else this package's stand-in, handed by path. */
export function editorConfigOf(names: readonly string[], standIn: string): ToolConfig {
    const own = names.find((name) => isFileOnDisk(name));
    if (own !== undefined) {
        return { args: [], ignoresOf: undefined, own, path: join(process.cwd(), own) };
    }
    const path = join(PACKAGE_ROOT, standIn);

    return { args: ['-c', path], ignoresOf: path, own: undefined, path };
}
