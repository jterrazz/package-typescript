import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { packedFiles, packedTree } from './packed-tree.js';

// A relative link to a page kept home is dead in `node_modules`. `docs/README.md` is the exception: the Docs
// (layout) pass holds it to a relative row for every chapter.

const ROOT = resolve(import.meta.dirname, '../../..');

const LINK = /\[[^\]\n]*\]\((?<target>[^)\s]+)\)/gu;

const SCHEME = /^[a-z][a-z+.-]*:/u;

function deadLinks(tree: string, files: string[]): string[] {
    const held = new Set(files);
    const holds = (path: string): boolean =>
        held.has(path) || files.some((file) => file.startsWith(`${path.replace(/\/$/u, '')}/`));

    return files.flatMap((file) =>
        [...readFileSync(join(tree, file), 'utf8').matchAll(LINK)]
            .map((match) => match.groups?.target ?? '')
            .filter((target) => !SCHEME.test(target) && !target.startsWith('#'))
            .map((target) => ({
                path: normalize(join(dirname(file), target.split('#')[0] ?? '')),
                target,
            }))
            .filter(({ path }) => existsSync(join(ROOT, path)) && !holds(path))
            .map(({ target }) => `${file}: ${target}`),
    );
}

test('every relative link the tarball carries lands in the tarball, the map aside', () => {
    // Given - every text file npm would publish
    const tree = packedTree();
    const files = packedFiles(tree).filter((path) => /\.(?:[cm]?js|d\.ts|md|sh|json)$/u.test(path));
    expect(files.filter((path) => path.endsWith('.md')).length).toBeGreaterThan(5);

    // Then - no link but the map's rows points at a page the tarball leaves out
    expect(
        deadLinks(tree, files).filter((link) => !link.startsWith('docs/README.md: ')),
    ).toStrictEqual([]);
});
