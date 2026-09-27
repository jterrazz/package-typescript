import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, lint } = await specification.lint({
    config: {
        categories: { correctness: 'off' },
        rules: { 'jterrazz-typescript/comment-no-longer-than-its-function': 'error' },
    },
    plugins: ['../../dist/plugin.js'],
});

afterAll(cleanup);
