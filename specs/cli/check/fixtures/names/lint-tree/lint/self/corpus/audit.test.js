import { expect, test } from 'vitest';

import { filesOf } from './audit.js';

test('audit — lists the root', () => {
    expect(filesOf('.')).toStrictEqual(['.']);
});
