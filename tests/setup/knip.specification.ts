import { cli } from '@jterrazz/test';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const RUN_KNIP = resolve(ROOT_DIR, 'tests/e2e/check/knip/run-knip.sh');

export const knipSpec = await cli({
    command: RUN_KNIP,
    root: '../e2e/check/knip/fixtures',
});

export const PACKAGE_ROOT = ROOT_DIR;
