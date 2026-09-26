import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxfmt');

// oxlint-disable-next-line jterrazz/cli-runs-the-product-binary -- the product is the oxfmt preset, which the CLI loads from a node_modules a copied fixture lacks
export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
