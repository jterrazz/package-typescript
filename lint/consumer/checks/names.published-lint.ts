import { matchesGlob } from 'node:path';

import type { Context } from '../../kit/checker/pass.js';
import type { JsonObject } from '../../kit/project/json.js';
import { withoutDotSlash } from '../../kit/project/packed-files.js';
import { buildSourcesOf } from './names.entries.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Manifest = JsonObject;

function targetsOfExports(exports: unknown): string[] {
    if (typeof exports === 'string') {
        return [exports];
    }
    if (exports === null || typeof exports !== 'object') {
        return [];
    }

    return Object.values(exports).flatMap((value) => targetsOfExports(value));
}

function lintOutputsOf(disk: Disk, unit: string): string[] {
    return [...buildSourcesOf(disk, unit)]
        .filter(([, source]) => source.startsWith('lint/'))
        .map(([name]) => `dist/${name}`);
}

function filesPublish(files: readonly unknown[], path: string): boolean {
    let published = false;
    for (const entry of files) {
        if (typeof entry !== 'string') {
            continue;
        }
        const excludes = entry.startsWith('!');
        const pattern = withoutDotSlash(excludes ? entry.slice(1) : entry).replace(/\/$/u, '');
        if (path === pattern || path.startsWith(`${pattern}/`) || matchesGlob(path, pattern)) {
            published = !excludes;
        }
    }

    return published;
}

// invariant: a `lint/` nothing publishes holds rules no consumer receives: `src/` under another name.
export function shipsLint(disk: Disk, manifest: Manifest, unit: string): boolean {
    const files: unknown[] = Array.isArray(manifest.files) ? manifest.files : [];
    const byFiles = files.some(
        (entry) =>
            typeof entry === 'string' && /^(?:\.\/)?lint(?:\/|$)/u.test(entry.replace(/^!.*/u, '')),
    );
    const targets = [
        ...targetsOfExports(manifest.exports),
        ...targetsOfExports(manifest.bin),
        ...targetsOfExports(manifest.main),
    ].map((target) => withoutDotSlash(target));
    const byExports = targets.some((target) => /^lint(?:\/|$)/u.test(target));
    const byBuild = lintOutputsOf(disk, unit).some(
        (output) =>
            targets.some((target) => target.startsWith(`${output}.`)) ||
            filesPublish(files, `${output}.js`),
    );

    return byFiles || byExports || byBuild;
}
