import { expect, test } from 'vitest';

import { filesOf } from './audit.js';
import { FRAGMENT_WALK } from './walks.js';

test('audit — lists the root', () => {
    expect(filesOf('.')).toStrictEqual(['.']);
    expect(FRAGMENT_WALK).toStrictEqual(['lint']);
});
