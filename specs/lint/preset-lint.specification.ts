import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, lint } = await specification.lint({
    presets: [],
    settings: { kind: 'library', platform: 'node' },
});

afterAll(cleanup);
