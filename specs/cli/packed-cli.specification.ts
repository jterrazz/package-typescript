import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// Not a third-party binary, so `cli-runs-the-product-binary` does not apply: the consumer's install is laid by the runner, from the tarball the run packed.
const CONSUMER = resolve(import.meta.dirname, '_setup/packed/consumer.ts');

export const { cleanup, cli } = await specification.cli(`node ${CONSUMER}`);

afterAll(cleanup);
