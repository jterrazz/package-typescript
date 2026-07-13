import { cli } from '@jterrazz/test';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const TSGO_BIN = resolve(ROOT_DIR, 'node_modules/.bin/tsgo');

export const tsgoSpec = await cli({
    command: TSGO_BIN,
    root: '../e2e',
});
