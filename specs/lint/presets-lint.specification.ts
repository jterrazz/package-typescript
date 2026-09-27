import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, lint } = await specification.lint({ presets: [] });

afterAll(cleanup);
