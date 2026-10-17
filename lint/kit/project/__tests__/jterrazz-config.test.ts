import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { readConfig, readConfigSync } from '../jterrazz-config.js';
import type { BasePresets } from '../preset.js';

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
            read[0].problem,
            read[0].resolved.sections.typescript,
            readConfigSync(bare, BASE).problem,
            readConfigSync(bare, BASE).resolved.sections.typescript,
            read[1].resolved.sections.typescript,
            readConfigSync(declared, BASE).resolved.sections.typescript,
        ];

        // Then - no file is no problem, every reading carries the two declared packages, the declared unit its kind
        expect(readings).toStrictEqual([
            null,
            { kind: 'none', uses: ['@prisma/client', 'vitest'] },
            null,
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

        // Then - the second reading is the first itself, and the broken file names its error
        expect(readConfigSync(unit, BASE)).toBe(first);
        expect([first.resolved.declaration, readConfigSync(broken, BASE).problem]).toStrictEqual([
            { kind: 'cli', platform: 'node' },
            'does not load: no settings here',
        ]);
    });

    test('readConfig and readConfigSync — a file exporting no settings object, or settings that do not resolve, is its problem', async () => {
        // Given - a settings file whose default export is a number, and one whose presets are no list
        const units = [
            unitWith({ 'jterrazz.config.ts': 'export default 42;\n' }),
            unitWith({ 'jterrazz.config.ts': "export default { presets: 'test' };\n" }),
        ];

        // When - each is read both ways
        const read = await Promise.all(units.map(async (unit) => await readConfig(unit, BASE)));
        const problems = [...read, ...units.map((unit) => readConfigSync(unit, BASE))].map(
            ({ problem }) => problem,
        );

        // Then - each says what the file lacks
        expect(problems).toStrictEqual([
            'exports no settings object as its default: write `export default defineConfig({ ... })`',
            'holds a `presets` that is not a list',
            'exports no settings object as its default: write `export default defineConfig({ ... })`',
            'holds a `presets` that is not a list',
        ]);
    });

    test('readConfig — a warning the settings file raises reaches the process, but Node’s typeless-package one, and the process keeps its own emitter', async () => {
        // Given - a settings file raising a typeless-package warning both ways Node spells it, then others: with a code, with none, with a type, with nothing
        const unit = unitWith({
            'jterrazz.config.ts': [
                "process.emitWarning('typeless', 'MODULE_TYPELESS_PACKAGE_JSON');",
                "process.emitWarning('typeless', { code: 'MODULE_TYPELESS_PACKAGE_JSON' });",
                "process.emitWarning('kept', { code: 'OTHER' });",
                "process.emitWarning('plain');",
                "process.emitWarning('typed', 'DeprecationWarning');",
                "process.emitWarning('nulled', null);",
                "export default { kind: 'cli', platform: 'node' };",
                '',
            ].join('\n'),
        });
        const warned: unknown[] = [];
        const emitter = (warning: unknown): void => {
            warned.push(warning);
        };
        const original: typeof process.emitWarning = Reflect.get(process, 'emitWarning');
        process.emitWarning = emitter;
        onTestFinished(() => {
            process.emitWarning = original;
        });

        // When - it is read
        await readConfig(unit, BASE);

        // Then - only the other warning reached the emitter, which is the process's again
        expect([warned, process.emitWarning === emitter]).toStrictEqual([
            ['kept', 'plain', 'typed', 'nulled'],
            true,
        ]);
    });
});
