import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// Not a third-party binary, so `cli-runs-the-product-binary` does not apply: an install tree no fixture can reproduce.
const BIN = resolve(import.meta.dirname, '_setup/run-strict-install.sh');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
