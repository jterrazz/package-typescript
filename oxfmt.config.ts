import { defineConfig } from 'oxfmt';

import preset from './presets/oxfmt/index.js';

export default defineConfig({
    ...preset,
    ignorePatterns: ['dist', 'node_modules', '**/fixtures', '**/inputs', '**/expected'],
});
