import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { readConfig, readConfigSync } from './jterrazz-config.js';
import type { BasePresets } from './preset.js';

function unitWith(files: Readonly<Record<string, string>>): string {
    const unit = mkdtempSync(join(tmpdir(), 'jterrazz-config-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const [name, text] of Object.entries(files)) {
        writeFileSync(join(unit, name), text);
    }

    return unit;
}

const MANIFEST = JSON.stringify({
    dependencies: { '@prisma/client': '^7.0.0' },
    devDependencies: { vitest: '^5.0.0' },
});

// value: the base names each package the unit's manifest declares, so a reading shows what it was handed.
const BASE: BasePresets = (declaration, dependencies) => [
    {
        name: 'typescript',
        package: '@jterrazz/typescript',
        settings: { kind: declaration?.kind ?? 'none', uses: [...(dependencies ?? [])] },
    },
];

describe('jterrazz-config', () => {
    test('readConfig and readConfigSync — the base presets read the packages the unit’s own manifest declares, with or without a settings file', async () => {
        // Given - a unit with a manifest and no settings file, and one declaring an api
        const bare = unitWith({ 'package.json': MANIFEST });
        const declared = unitWith({
            'jterrazz.config.ts': "export default { kind: 'api', platform: 'node' };\n",
            'package.json': MANIFEST,
        });

        // When - each is read both ways
        const read = await Promise.all([readConfig(bare, BASE), readConfig(declared, BASE)]);
        const readings = [
            read[0].resolved.sections.typescript,
            readConfigSync(bare, BASE).resolved.sections.typescript,
            read[1].resolved.sections.typescript,
            readConfigSync(declared, BASE).resolved.sections.typescript,
        ];

        // Then - every reading carries the two declared packages, the declared unit its kind
        expect(readings).toStrictEqual([
            { kind: 'none', uses: ['@prisma/client', 'vitest'] },
            { kind: 'none', uses: ['@prisma/client', 'vitest'] },
            { kind: 'api', uses: ['@prisma/client', 'vitest'] },
            { kind: 'api', uses: ['@prisma/client', 'vitest'] },
        ]);
    });

    test('readConfigSync — a settings file is read once per process, and one that fails to load is its problem', () => {
        // Given - a unit whose settings file loads, then changes, and one whose file throws
        const unit = unitWith({
            'jterrazz.config.ts': "export default { kind: 'cli', platform: 'node' };\n",
        });
        const first = readConfigSync(unit, BASE);
        writeFileSync(
            join(unit, 'jterrazz.config.ts'),
            "export default { kind: 'api', platform: 'node' };\n",
        );
        const broken = unitWith({ 'jterrazz.config.ts': "throw new Error('no settings here');\n" });

        // Then - the second reading is the first, and the broken file names its error
        expect([readConfigSync(unit, BASE), first.resolved.declaration]).toStrictEqual([
            first,
            { kind: 'cli', platform: 'node' },
        ]);
        expect(readConfigSync(broken, BASE).problem).toBe('does not load — no settings here');
    });
});
