import { readdirSync } from 'node:fs';
import { defineConfig } from 'tsdown';

const PROFILE_SOURCES = 'src/presets/oxlint/profiles';

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
                readdirSync(PROFILE_SOURCES).map((file) => [
                    `presets/oxlint/profiles/${file.replace(/\.ts$/u, '')}`,
                    `${PROFILE_SOURCES}/${file}`,
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
