// Consumer #1 of the oxfmt entry, self-referenced through the exports map.
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig({
    ...base,
    /* Generated docs projections (typedoc markdown) and golden trees are byte-for-byte artifacts of `typescript docs` — formatting them would fight the Docs (sync) pass. */
    ignorePatterns: ['dist', 'node_modules', '**/_fixtures', 'docs/reference', '**/_expected'],
});
