import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { TERMINAL_REPORT } from './__setup__/oxlint-forms.js';

// invariant: not a third-party binary, so `cli-runs-the-product-binary` does not apply: an install tree no fixture can reproduce.
const BIN = resolve(import.meta.dirname, '__setup__/run-split-install.ts');

export const { cli, cleanup } = await specification.cli(BIN, {
    defaults: TERMINAL_REPORT,
});

afterAll(cleanup);
