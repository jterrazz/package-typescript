import { defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

export default defineConfig(fromPresets(settings));
