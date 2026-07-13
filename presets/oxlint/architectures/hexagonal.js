import { resolve } from 'node:path';
import { defineConfig } from 'oxlint';

import defaultRules from './hexagonal-rules.js';

const pluginPath = resolve(import.meta.dirname, '../plugins/codestyle.js');

export default defineConfig({
    jsPlugins: [pluginPath],
    rules: {
        'codestyle/arch-hexagonal': ['error', { rules: defaultRules }],
    },
});
