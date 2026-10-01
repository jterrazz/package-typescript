import process from 'node:process';
import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

import { buildEntriesOf } from '../../../lint/engine/project/entry-points.js';

export type { UserConfig } from 'tsdown';

/** An application build: ESM with declarations and source maps, an output per published entry. */
const build: UserConfig = defineConfig({
    entry: buildEntriesOf(process.cwd()),
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: () => ({
        js: '.js',
    }),
});

export default build;
