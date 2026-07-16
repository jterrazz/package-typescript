import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const RUN_SPLIT_INSTALL = resolve(ROOT_DIR, 'tests/e2e/check/resolution/run-split-install.sh');

export const resolutionSpec = asCommandRunner(
    await spec(command(RUN_SPLIT_INSTALL), {
        root: '../..',
    }),
);

export const PACKAGE_ROOT = ROOT_DIR;
