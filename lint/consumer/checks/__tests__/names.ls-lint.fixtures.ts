import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import LIBRARY from '../../../../src/standard/kinds/library.js';
import type { LintTrees } from '../names.ls-lint.js';

const LINT_TREE = LIBRARY.typescript?.lint ?? {};

export const treesOf = (units: readonly string[]): LintTrees =>
    Object.fromEntries(units.map((unit) => [unit, LINT_TREE]));

export const LS_LINT = join(import.meta.dirname, '../../../../node_modules/.bin/ls-lint');

/** Lays each path on a scratch disk, a module in each file. */
export function onDisk(paths: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'names-ls-lint-'));
    for (const path of paths) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), 'export {};\n');
    }

    return root;
}
