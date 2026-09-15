import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/*
 * Sandbox runner: run-install-matrix.sh builds pnpm's strict install layout —
 * the package and its own dependencies in the store, a consumer whose
 * node_modules holds only what its manifest declares — copies one consumer per
 * profile into it, and runs `typescript check` in each. It is not a
 * third-party binary in node_modules/.bin, so B9w does not apply: it exercises
 * the product command inside an install tree no fixture can reproduce.
 */
const BIN = resolve(import.meta.dirname, 'run-install-matrix.sh');

export const { cleanup, cli } = await specification.cli(BIN);

afterAll(cleanup);
