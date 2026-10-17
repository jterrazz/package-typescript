import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({ server: () => createApp() });

afterAll(cleanup);
