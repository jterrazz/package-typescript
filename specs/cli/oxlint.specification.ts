import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/*
 * B9w exception: these specs assert the shipped OXLINT PRESET configs
 * (base/node/expo/next + hexagonal architecture) by pointing oxlint at a preset
 * with `-c <preset>`. Routing through `typescript check` cannot exercise them:
 * `check` loads the preset from the consumer's node_modules, and a copied
 * temp-workdir fixture has no node_modules, so the preset never loads. The
 * product this file guards IS the oxlint preset, so pointing at oxlint is correct.
 */
const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxlint');

// oxlint-disable-next-line jterrazz/b9w-product-command -- exercises the oxlint preset configs; see note above
export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
