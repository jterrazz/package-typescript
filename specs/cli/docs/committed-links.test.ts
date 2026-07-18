import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

/* Dogfood guard on THIS repo's committed projection. The E2E fixtures are not
 * git repos, so they can never exhibit the bootstrap paradox: typedoc pinning
 * source links to a commit SHA. A SHA link names the commit BEFORE the one
 * carrying the regenerated docs, so every docs-carrying commit would invalidate
 * its own projection and the Docs (sync) pass could never be green at HEAD.
 * Links must therefore point at the branch (`blob/main/`), never a SHA. */

const REFERENCE_ROOT = resolve(import.meta.dirname, '../../../docs/reference');

const markdownFilesUnder = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => join(entry.parentPath, entry.name));
};

test('committed reference docs link to the branch, never a commit sha', async () => {
    // Given - every markdown file of this repo's committed docs/reference tree
    const files = await markdownFilesUnder(REFERENCE_ROOT);
    expect(files.length).toBeGreaterThan(0);

    // Then - no source link pins a 40-hex commit SHA (the bootstrap paradox above)
    for (const file of files) {
        const content = await readFile(file, 'utf8');
        expect(content, `${file} must use blob/main/ links`).not.toMatch(/blob\/[0-9a-f]{40}\//);
    }
});
