import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { laidOutHexagonally } from '../hexagonal-layout.js';

function unitHolding(folders: readonly string[]): string {
    const unit = mkdtempSync(join(tmpdir(), 'hexagonal-layout-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const folder of folders) {
        mkdirSync(join(unit, folder), { recursive: true });
    }

    return unit;
}

describe('laidOutHexagonally', () => {
    test('src/ holding domain/, application/ and infrastructure/, and nothing less, nor the layers outside src/', () => {
        // Given - the three layers under src/, two of them, the three at the unit's root, and all but domain/
        const units = [
            unitHolding(['src/domain', 'src/application', 'src/infrastructure']),
            unitHolding(['src/domain', 'src/application']),
            unitHolding(['domain', 'application', 'infrastructure']),
            unitHolding(['src/application', 'src/infrastructure']),
        ];

        // Then - only the first is laid out hexagonally
        expect(units.map((unit) => laidOutHexagonally(unit))).toStrictEqual([
            true,
            false,
            false,
            false,
        ]);
    });
});
