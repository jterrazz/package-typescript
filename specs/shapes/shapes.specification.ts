import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// invariant: a shape is laid and run by the kinds' runner: the same install, from the tarballs the run packed.
const SPECIMEN = resolve(import.meta.dirname, '../kinds/__setup__/specimen.ts');

export const { cleanup, cli } = await specification.cli(`node ${SPECIMEN}`);

afterAll(cleanup);
