import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../..');

export const { cleanup, lint } = await specification.lint({
    checkers: [
        `node ${REPOSITORY}/dist/checker.js architecture --depcruise ${REPOSITORY}/node_modules/.bin/depcruise`,
    ],
});

afterAll(cleanup);
