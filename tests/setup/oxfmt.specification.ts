import { cli } from '@jterrazz/test';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const OXFMT_BIN = resolve(ROOT_DIR, 'node_modules/.bin/oxfmt');

export const oxfmtSpec = await cli({
    command: OXFMT_BIN,
    root: '../e2e',
});
