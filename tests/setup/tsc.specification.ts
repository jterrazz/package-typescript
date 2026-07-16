import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const TSC_BIN = resolve(
    ROOT_DIR,
    `node_modules/@typescript/typescript-${process.platform}-${process.arch}/lib/tsc`,
);

export const tscSpec = asCommandRunner(
    await spec(command(TSC_BIN), {
        root: '../e2e/check',
    }),
);
