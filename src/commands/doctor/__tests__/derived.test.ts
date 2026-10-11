import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { resolveConfig } from '../../../../lint/kit/project/preset.js';
import type { Preset } from '../../../../lint/kit/project/preset.js';
import { derivedOf } from '../derived.js';

function unitWith(...sources: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'doctor-derived-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const source of sources) {
        mkdirSync(join(root, source, '..'), { recursive: true });
        writeFileSync(join(root, source), 'export {};\n');
    }

    return root;
}

function resolvedWith(...presets: Preset[]) {
    return resolveConfig({ presets }, () => []).resolved;
}

const DERIVING: Preset = {
    derive: (unit) => ({ projects: { unit: unit.length > 0 } }),
    name: 'test',
    package: '@acme/test',
};

const PLAIN: Preset = { name: 'plain', package: '@acme/plain' };

describe('derived', () => {
    test('derivedOf — names the build entries and the dev scripts the tree holds, each section only where it holds some', () => {
        // Given - a unit with a worker module and a command script, one with a worker alone, one with a script alone, and one with neither
        const both = unitWith('src/digest.worker.ts', 'lint/release.cli.ts');
        const entriesOnly = unitWith('src/digest.worker.ts');
        const devOnly = unitWith('lint/release.cli.ts');
        const neither = unitWith('src/orders.ts');
        const resolved = resolvedWith();

        // Then - each build holds only what the tree names
        expect(
            [both, entriesOnly, devOnly, neither].map((unit) => derivedOf(unit, resolved)),
        ).toStrictEqual([
            {
                build: {
                    dev: { release: 'lint/release.cli.ts' },
                    entries: { 'digest.worker': 'src/digest.worker.ts' },
                },
            },
            { build: { entries: { 'digest.worker': 'src/digest.worker.ts' } } },
            { build: { dev: { release: 'lint/release.cli.ts' } } },
            {},
        ]);
    });

    test('derivedOf — adds what each preset derives from the unit under the preset’s name, and nothing for a preset that derives nothing', () => {
        // Given - a unit, and a resolution of a preset that derives and one that does not
        const unit = unitWith('src/orders.ts');
        const resolved = resolvedWith(DERIVING, PLAIN);

        // Then - the deriving preset's reading of this unit, under its name
        expect(derivedOf(unit, resolved)).toStrictEqual({ test: { projects: { unit: true } } });
    });
});
