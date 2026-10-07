import { specification } from '@jterrazz/test';
import { join, resolve } from 'node:path';
import { afterAll } from 'vitest';

const PACKAGE = resolve(import.meta.dirname, '../..');

export const { cleanup, cli } = await specification.cli(join(PACKAGE, 'dist/greet.js'));

afterAll(cleanup);
