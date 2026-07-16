import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const OXLINT_BIN = resolve(ROOT_DIR, 'node_modules/.bin/oxlint');

export const oxlintSpec = asCommandRunner(
    await spec(command(OXLINT_BIN), {
        root: '../e2e/check',
    }),
);
