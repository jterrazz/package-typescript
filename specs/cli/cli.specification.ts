import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// The ONE real runner: every spec goes through the product command
// (`typescript build|bundle|dev|start|docs|check|fix`), never a tool underneath it.
const BIN = resolve(import.meta.dirname, '../../bin/typescript.sh');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
