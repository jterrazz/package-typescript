import { join } from 'node:path';

import { spyOn } from '@vitest/spy';
import { mocker } from '@vitest/mocker';
import ms from 'ms';
import { chromium } from 'playwright';
import { defineConfig } from 'vitest/config';

export const tools = [join, spyOn, mocker, ms, chromium, defineConfig];
