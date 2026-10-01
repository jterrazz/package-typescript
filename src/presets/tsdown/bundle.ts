import process from 'node:process';
import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

import { buildEntriesOf } from '../../../lint/engine/project/entry-points.js';

export type { UserConfig } from 'tsdown';

/** A library bundle: ESM and CJS with declarations and source maps, an output per published entry. */
const bundle: UserConfig = defineConfig({
    entry: buildEntriesOf(process.cwd()),
    format: ['esm', 'cjs'],
    // Only the published build: under the tsconfig it would also bind every spec's destructured export.
    dts: { compilerOptions: { isolatedDeclarations: true } },
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
});

export default bundle;
