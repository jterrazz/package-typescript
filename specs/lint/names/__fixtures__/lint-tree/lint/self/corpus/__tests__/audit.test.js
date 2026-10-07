import { expect, test } from 'vitest';

import { filesOf } from '../audit.js';
import { FRAGMENT_WALK } from '../walks.js';
import { ROOTS } from './trees.fixtures.js';

test('audit — lists the root', () => {
    expect(filesOf('.')).toStrictEqual(ROOTS);
    expect(FRAGMENT_WALK).toStrictEqual(['lint']);
});
