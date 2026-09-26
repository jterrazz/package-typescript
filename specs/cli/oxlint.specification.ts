import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxlint');

// oxlint-disable-next-line jterrazz/cli-runs-the-product-binary -- the product is the oxlint preset, which `check` loads from a node_modules a copied fixture lacks
export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
