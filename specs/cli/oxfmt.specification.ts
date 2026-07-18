import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/*
 * B9w exception: these specs assert the shipped OXFMT PRESET (single quotes,
 * semicolons, four-space indent) by pointing oxfmt at the preset with
 * `--config <preset>`. Routing through `typescript fix`/`check` cannot exercise
 * them: the preset is loaded from the consumer's node_modules, absent in a copied
 * temp-workdir fixture. The product this file guards IS the oxfmt preset.
 */
const BIN = resolve(import.meta.dirname, '../../node_modules/.bin/oxfmt');

// oxlint-disable-next-line jterrazz/b9w-product-command -- exercises the oxfmt preset; see note above
export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
