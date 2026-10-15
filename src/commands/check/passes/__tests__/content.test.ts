import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { holdsContentOnly } from '../content.js';

function unitDeclaring(settings: null | string): string {
    const unit = mkdtempSync(join(tmpdir(), 'setup-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    if (settings !== null) {
        writeFileSync(join(unit, 'jterrazz.config.ts'), settings);
    }

    return unit;
}

describe('holdsContentOnly', () => {
    test('is true for a unit that declares content, and false for a project and a unit that declares nothing', async () => {
        // Given - a content repository, a library and a folder with no settings file
        const content = unitDeclaring("export default { kind: 'content' };\n");
        const library = unitDeclaring("export default { kind: 'library', platform: 'node' };\n");
        const bare = unitDeclaring(null);

        // Then - only the first is a repository with no code
        expect([
            await holdsContentOnly(content),
            await holdsContentOnly(library),
            await holdsContentOnly(bare),
        ]).toStrictEqual([true, false, false]);
    });
});
