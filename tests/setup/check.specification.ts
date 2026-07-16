import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const BIN = resolve(ROOT_DIR, 'bin/typescript.sh');

export const checkSpec = asCommandRunner(
    await spec(command(BIN), {
        root: '../..',
    }),
);
