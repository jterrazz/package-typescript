import { mocker } from '@vitest/mocker';
import { spyOn } from '@vitest/spy';
import ms from 'ms';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { defineConfig } from 'vitest/config';

export const tools = [join, spyOn, mocker, ms, chromium, defineConfig];
