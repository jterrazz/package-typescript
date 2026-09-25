import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// B9w exception: the product is the oxlint preset, which `check` loads from a node_modules a copied fixture lacks.
const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxlint');

// oxlint-disable-next-line jterrazz/b9w-product-command -- exercises the oxlint preset configs; see note above
export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
