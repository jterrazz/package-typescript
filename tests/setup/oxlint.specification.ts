import { cli } from '@jterrazz/test';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const OXLINT_BIN = resolve(ROOT_DIR, 'node_modules/.bin/oxlint');

export const oxlintSpec = await cli({
    command: OXLINT_BIN,
    root: '../e2e',
});
