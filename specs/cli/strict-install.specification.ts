import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// Not a third-party binary, so B9w does not apply: an install tree no fixture can reproduce.
const BIN = resolve(import.meta.dirname, 'run-strict-install.sh');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
