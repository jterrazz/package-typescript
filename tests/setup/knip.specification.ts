import { command, spec } from '@jterrazz/test';
import { resolve } from 'node:path';

import { asCommandRunner } from './command-runner.js';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const RUN_KNIP = resolve(ROOT_DIR, 'tests/e2e/check/knip/run-knip.sh');

export const knipSpec = asCommandRunner(
    await spec(command(RUN_KNIP), {
        root: '../e2e/check/knip/fixtures',
    }),
);

export const PACKAGE_ROOT = ROOT_DIR;
