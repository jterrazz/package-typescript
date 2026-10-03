import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { dirname, join } from 'node:path';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import type { JsonObject } from '../../../lint/kit/project/json.js';
import { isGitIgnored, PRUNED } from '../../../lint/kit/project/project-files.js';
import { isFileOnDisk } from '../disk.js';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

function manifestIn(dir: string): JsonObject | null {
    try {
        return parsedObject(readFileSync(join(dir, 'package.json'), 'utf8'));
    } catch {
        return null;
    }
}

function declares(dir: string, name: string): boolean {
    const manifest = manifestIn(dir);

    return (
        manifest !== null &&
        DEPENDENCY_FIELDS.some((field) => Boolean(objectOf(manifest[field])[name]))
    );
}

export function usesAstro(dir: string): boolean {
    return declares(dir, 'astro');
}

export function isModulePackage(): boolean {
    return manifestIn('.')?.type === 'module';
}

export function nearestPackageDir(from: string): null | string {
    let dir = from;
    while (!isFileOnDisk(join(dir, 'package.json'))) {
        if (dir === '.') {
            return null;
        }
        dir = dirname(dir);
    }

    return dir;
}

function insideOwningMember(path: string, member: string): boolean {
    for (
        let dir = dirname(path);
        dir !== member && dir !== '.' && dir !== '/';
        dir = dirname(dir)
    ) {
        if (existsSync(join(dir, '.git')) || isFileOnDisk(join(dir, 'package.json'))) {
            return false;
        }
    }

    return true;
}

function specsDirectoriesUnder(dir: string): string[] {
    let entries: Dirent[];
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    return entries
        .filter((entry) => entry.isDirectory() && !PRUNED.has(entry.name))
        .flatMap((entry) => {
            const path = join(dir, entry.name);

            return entry.name === 'specs' ? [path] : specsDirectoriesUnder(path);
        });
}

const byBytes = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

export function specsRoots(members: readonly string[]): string[] {
    const roots = [
        ...(existsSync('specs') && !isGitIgnored('.', 'specs') ? ['specs'] : []),
        ...members.flatMap((member) =>
            specsDirectoriesUnder(member).filter(
                (candidate) =>
                    !isGitIgnored('.', candidate) && insideOwningMember(candidate, member),
            ),
        ),
    ];

    return [...new Set(roots)].toSorted(byBytes);
}
