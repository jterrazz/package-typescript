import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const OXFMT_BIN = resolve(ROOT_DIR, 'node_modules/.bin/oxfmt');

export const oxfmtSpec = asCommandRunner(
    await spec(command(OXFMT_BIN), {
        root: '../e2e/check',
    }),
);
