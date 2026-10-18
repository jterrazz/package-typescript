import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// invariant: not a third-party binary, so `cli-runs-the-product-binary` does not apply: a clone of this repository, which no fixture can reproduce.
const BIN = resolve(import.meta.dirname, '__setup__/run-fresh-clone.ts');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
