import { defineConfig } from 'oxfmt';

import preset from './presets/oxfmt/index.js';

export default defineConfig({
    ...preset,
    /* Generated docs projections (typedoc markdown) and golden trees are byte-for-byte artifacts of `typescript docs` — formatting them would fight the Docs (sync) pass. */
    ignorePatterns: ['dist', 'node_modules', '**/fixtures', 'docs/reference', '**/expected'],
});
