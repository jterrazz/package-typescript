import { expect, test } from 'vitest';

import config from './index.js';

test('index — ships a config', () => {
    expect(config).toStrictEqual({ rules: {} });
});
