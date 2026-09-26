import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { importersOf } from './importers.js';

function unitWith(tree: Record<string, string>): string {
    const unit = mkdtempSync(join(tmpdir(), 'importers-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const [path, content] of Object.entries(tree)) {
        mkdirSync(dirname(join(unit, path)), { recursive: true });
        writeFileSync(join(unit, path), content);
    }

    return unit;
}

describe('importers', () => {
    test('maps each module to the modules importing it, a written .js reaching its .ts source', () => {
        // Given - a module read by a static import, a dynamic one and a re-export, and one imported only from a fixture
        const tree = {
            'lint/engine/tree.ts': 'export const tree = 1;\n',
            'lint/consumer/checks/a.ts': "import { tree } from '../../engine/tree.js';\n",
            'lint/consumer/checks/b.ts': "const loaded = await import('../../engine/tree.js');\n",
            'lint/index.ts': "export { tree } from './engine/tree.js';\n",
            'lint/engine/alone.ts': 'export const alone = 1;\n',
            'specs/fixtures/project/reads.ts':
                "import { alone } from '../../../lint/engine/alone.js';\n",
        };
        const unit = unitWith(tree);

        // Then - the three readers are named, and a fixture reads nothing
        const importers = importersOf(unit, Object.keys(tree));
        expect(importers.get('lint/engine/tree.ts')).toStrictEqual(
            new Set(['lint/consumer/checks/a.ts', 'lint/consumer/checks/b.ts', 'lint/index.ts']),
        );
        expect(importers.has('lint/engine/alone.ts')).toBe(false);
    });
});
