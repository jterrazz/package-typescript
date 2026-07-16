import { command, spec as createSpec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const CLI_BIN = resolve(import.meta.dirname, '../../bin/typescript.sh');

export const spec = asCommandRunner(
    await createSpec(command(CLI_BIN), {
        root: '../fixtures',
    }),
);
