import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/*
 * Sandbox runner: run-split-install.sh builds a synthetic split-install layout
 * (oxlint nested under the package, the other tools hoisted to the consumer root)
 * and then EXECs the product's real `check.sh`. It is not a third-party binary in
 * node_modules/.bin, so b9w does not apply — it exercises the product command
 * inside a constructed install tree that a plain fixture cannot reproduce.
 */
const BIN = resolve(import.meta.dirname, 'run-split-install.sh');

export const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
