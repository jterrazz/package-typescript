import { cli } from '@jterrazz/test';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '../..');
const BIN = resolve(ROOT_DIR, 'bin/typescript.sh');

export const checkSpec = await cli({
    command: BIN,
    root: '../..',
});
