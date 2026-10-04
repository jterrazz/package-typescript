import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'website',
    platform: 'react',
    presets: [test()],
    test: { projects: [{ facet: 'unit' }] },
});
