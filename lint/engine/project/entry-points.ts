import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isJsonObject, parsedObject } from './json.js';

// In Node's resolution order; the empty string is "no target".
function targetOf(entry: unknown): string {
    if (typeof entry === 'string') {
        return entry;
    }
    if (!isJsonObject(entry)) {
        return '';
    }
    for (const condition of ['import', 'default', 'require']) {
        const nested = targetOf(entry[condition]);
        if (nested !== '') {
            return nested;
        }
    }
    return '';
}

function sourceOf(target: string): string {
    const match = /^\.\/dist\/(?<path>.+)\.(?:js|mjs|cjs)$/u.exec(target);
    return match === null ? '' : `src/${match.groups?.path ?? ''}.ts`;
}

export function entryPoints(root: string): string[] {
    const manifest = join(root, 'package.json');
    if (!existsSync(manifest)) {
        return [];
    }

    let exported: unknown;
    try {
        exported = parsedObject(readFileSync(manifest, 'utf8')).exports;
    } catch {
        return [];
    }
    if (typeof exported !== 'object' || exported === null) {
        return [];
    }

    const entries = new Set<string>();
    for (const [subpath, entry] of Object.entries(exported)) {
        if (subpath.includes('*')) {
            continue;
        }
        const source = sourceOf(targetOf(entry));
        if (source !== '' && existsSync(join(root, source))) {
            entries.add(source);
        }
    }

    return [...entries].toSorted((left, right) => left.localeCompare(right));
}
