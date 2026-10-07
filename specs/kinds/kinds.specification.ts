import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// invariant: not a third-party binary, so `cli-runs-the-product-binary` does not apply: the specimen's install is laid by the runner, from the tarballs the run packed.
const SPECIMEN = resolve(import.meta.dirname, '__setup__/specimen.ts');

export const { cleanup, cli } = await specification.cli(`node ${SPECIMEN}`);

afterAll(cleanup);
