import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

/*
 * Sandbox runner: run-strict-install.sh builds pnpm's STRICT install layout —
 * a consumer whose node_modules holds @jterrazz/typescript alone, the package's
 * own dependencies in the store beside it — writes the documented oxlint and
 * oxfmt configs into it, and runs both tools there. It is not a third-party
 * binary in node_modules/.bin, so B9w does not apply: it exercises the config
 * shape the corpus prescribes, inside an install tree no fixture can reproduce.
 */
const BIN = resolve(import.meta.dirname, 'run-strict-install.sh');

export const { cli, cleanup } = await specification.cli(BIN);

afterAll(cleanup);
