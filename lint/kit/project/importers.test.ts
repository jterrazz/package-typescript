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

function readerTaking(names: string[]): Map<string, Set<string>> {
    return new Map([['src/reader.ts', new Set(names)]]);
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

    test('resolves a specifier written without its extension, to a folder, or to plain JavaScript', () => {
        // Given - one reader importing each shape a specifier takes, a namespace, a default, itself and a module that is not there
        const tree = {
            'src/reader.ts': [
                "import { tree } from './tree';",
                "import * as kit from './kit';",
                "import legacy from './legacy';",
                "import { lib } from './lib';",
                "import { subtype as kind, type  Leaf, walk  as walked } from './shapes.js';",
                "import { reader } from './reader.js';",
                "import { gone } from './gone.js';",
                '',
            ].join('\n'),
            'src/tree.ts': '',
            'src/kit/index.ts': '',
            'src/legacy.js': '',
            'src/lib/index.js': '',
            'src/shapes.ts': '',
        };
        const unit = unitWith(tree);

        // Then - each module is reached from the reader, by the names it takes, and nothing else is mapped
        expect(importersOf(unit, Object.keys(tree))).toStrictEqual(
            new Map([
                ['src/tree.ts', readerTaking(['tree'])],
                ['src/kit/index.ts', readerTaking(['*'])],
                ['src/legacy.js', readerTaking([])],
                ['src/lib/index.js', readerTaking(['lib'])],
                ['src/shapes.ts', readerTaking(['subtype', 'Leaf', 'walk'])],
            ]),
        );
    });

    test('reaches a built .mjs or .cjs specifier its own source, never a sibling the name shortens to', () => {
        // Given - a reader of two built specifiers, beside modules a wrongly cut name would land on
        const tree = {
            'src/reader.ts':
                "import { a } from './esm.mjs';\nimport { b } from './cjs.cjs';\nimport { c } from './t';\n",
            'src/esm.mts': '',
            'src/cjs.cts': '',
            'src/t.ts': '',
            'src/cjs.mts': '',
        };
        const unit = unitWith(tree);

        // Then - each is reached by its own source alone
        expect([...importersOf(unit, Object.keys(tree)).keys()]).toStrictEqual([
            'src/esm.mts',
            'src/cjs.cts',
            'src/t.ts',
        ]);
    });
});
