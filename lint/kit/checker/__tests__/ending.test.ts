import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { inScratch } from '../ending.js';

describe('ending', () => {
    test('inScratch — works in a folder of its own inside the parent it is handed, made if missing, and removes it with what it holds once the work ends', async () => {
        // Given - a parent folder that does not exist yet
        const root = mkdtempSync(join(tmpdir(), 'ending-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const parent = join(root, '.artifacts');

        // When - the work writes a file in its scratch
        const scratch = await inScratch(async (folder) => {
            writeFileSync(join(folder, 'tsdown.config.mjs'), 'export default [];\n');

            return await Promise.resolve(folder);
        }, parent);

        // Then - the scratch sat inside the parent, and is gone with its file
        expect({ gone: !existsSync(scratch), inside: dirname(scratch) }).toStrictEqual({
            gone: true,
            inside: parent,
        });
    });
});
