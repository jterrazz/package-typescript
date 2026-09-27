import { defineConfig } from 'tsdown';

const PROFILES = ['astro', 'bun', 'expo', 'next', 'node', 'react'];

export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: {
            checker: 'lint/index.checker.ts',
            command: 'src/command/index.ts',
            config: 'src/config.ts',
            docs: 'lint/index.docs.ts',
            index: 'src/index.ts',
            oxfmt: 'src/oxfmt.ts',
            oxlint: 'lint/index.ts',
            plugin: 'lint/consumer/rules/plugin.ts',
            'presets/oxfmt/index': 'src/presets/oxfmt/index.ts',
            'presets/tsdown/build': 'src/presets/tsdown/build.ts',
            'presets/tsdown/bundle': 'src/presets/tsdown/bundle.ts',
            ...Object.fromEntries(
                PROFILES.map((name) => [
                    `presets/oxlint/profiles/${name}`,
                    `src/presets/oxlint/profiles/${name}.ts`,
                ]),
            ),
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        outputOptions: { chunkFileNames: 'shared-[name].js' },
        platform: 'node',
        sourcemap: false,
    },
    {
        clean: false,
        dts: false,
        entry: { self: 'lint/self/index.ts' },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        outputOptions: { chunkFileNames: 'self-[name].js' },
        platform: 'node',
        sourcemap: false,
    },
]);
