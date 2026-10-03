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
    test('maps each module to the modules importing it and the names each takes, a written .js reaching its .ts source', () => {
        // Given - a module read by a named import, a dynamic one and a re-export, and one imported only from a fixture
        const tree = {
            'lint/kit/tree.ts': 'export const tree = 1;\n',
            'lint/consumer/checks/a.ts':
                "import {\n    tree,\n    type Leaf,\n    walk as walked,\n} from '../../kit/tree.js';\n",
            'lint/consumer/checks/b.ts': "const loaded = await import('../../kit/tree.js');\n",
            'lint/index.ts': "export { tree } from './kit/tree.js';\n",
            'lint/kit/alone.ts': 'export const alone = 1;\n',
            'specs/_fixtures/project/reads.ts':
                "import { alone } from '../../../lint/kit/alone.js';\n",
        };
        const unit = unitWith(tree);

        // Then - the three readers are named with what each takes — every name for a dynamic import — and a fixture reads nothing
        const importers = importersOf(unit, Object.keys(tree));
        expect(importers.get('lint/kit/tree.ts')).toStrictEqual(
            new Map([
                ['lint/consumer/checks/a.ts', new Set(['tree', 'Leaf', 'walk'])],
                ['lint/consumer/checks/b.ts', new Set(['*'])],
                ['lint/index.ts', new Set(['tree'])],
            ]),
        );
        expect(importers.has('lint/kit/alone.ts')).toBe(false);
    });
});
