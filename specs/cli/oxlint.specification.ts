import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { ONE_FORM } from './__setup__/oxlint-forms.js';

const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxlint');

// hazard: a fixture runs outside the checkout, where oxlint finds `tsgolint` only on the PATH, which `npm test` extends and a bare `vitest` does not: a config whose type-aware rules find no tsgolint exits 1 and reports no finding.
const TSGOLINT = resolve(import.meta.dirname, '../../node_modules/.bin/tsgolint');

// oxlint-disable-next-line jterrazz/cli-runs-the-product-binary -- the product is the oxlint preset, which `check` loads from a node_modules a copied fixture lacks
export const { cli, cleanup } = await specification.cli(BIN, {
    defaults: { ...ONE_FORM, OXLINT_TSGOLINT_PATH: TSGOLINT },
});

afterAll(cleanup);
