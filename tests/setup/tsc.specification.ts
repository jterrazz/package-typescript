import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const TSC_BIN = resolve(ROOT_DIR, 'node_modules/typescript-go/bin/tsc');

export const tscSpec = asCommandRunner(
    await spec(command(TSC_BIN), {
        root: '../e2e/check',
    }),
);
