import { specification } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const PACKAGE = resolve(import.meta.dirname, '../..');
const BINARY = resolve(PACKAGE, '.artifacts/go/greet');

execFileSync('go', ['build', '-o', BINARY, './src/cmd/greet'], { cwd: PACKAGE, stdio: 'inherit' });

export const { cleanup, cli } = await specification.cli(BINARY);

afterAll(cleanup);
