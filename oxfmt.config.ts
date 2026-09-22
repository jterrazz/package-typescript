// Consumer #1 of the oxfmt entry, self-referenced through the exports map.
import { base, defineConfig } from '@jterrazz/typescript/oxfmt';

export default defineConfig({
    ...base,
    // This repository's own specs still stand on @jterrazz/test 16's underscored
    // ground; the preset names 17's bare folders. The two lines go with the
    // migration of specs/ to the 17 runner.
    ignorePatterns: [...(base.ignorePatterns ?? []), '**/_fixtures/**', '**/_expected/**'],
});
