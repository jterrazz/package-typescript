import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// invariant: not a third-party binary, so `cli-runs-the-product-binary` does not apply: an install tree no fixture can reproduce.
const BIN = resolve(import.meta.dirname, '__setup__/run-hoisted-baseline.ts');

export const { cleanup, cli } = await specification.cli(BIN);

afterAll(cleanup);
