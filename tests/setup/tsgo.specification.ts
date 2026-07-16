import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const TSGO_BIN = resolve(ROOT_DIR, 'node_modules/.bin/tsgo');

export const tsgoSpec = asCommandRunner(
    await spec(command(TSGO_BIN), {
        root: '../e2e/check',
    }),
);
