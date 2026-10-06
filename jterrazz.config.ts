import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: [test()],
    test: {
        projects: {
            cli: {
                include: ['specs/cli/**/*.spec.ts', 'specs/kinds/**/*.spec.ts'],
                reason: 'the specimens of specs/kinds/ run the packed command as the cli specs do; a run lays its fixtures under /tmp and packs the package once, and a packed install outlives the 30 s budget',
                setup: ['specs/cli/_setup/run-temp-root.ts', 'specs/cli/_setup/packed/per-run.ts'],
                timeout: 120_000,
            },
        },
    },
    typescript: {
        knip: {
            entry: {
                'specs/cli/_setup/packed/consumer.ts':
                    'specs/cli/packed-cli.specification.ts spawns it by its path',
                'specs/cli/_setup/run-install-matrix.ts':
                    'specs/cli/install-matrix.specification.ts spawns it by its path',
                'specs/cli/_setup/run-split-install.ts':
                    'specs/cli/resolution.specification.ts spawns it by its path',
                'specs/cli/_setup/run-strict-install.ts':
                    'specs/cli/strict-install.specification.ts spawns it by its path',
                'specs/kinds/_setup/specimen.ts':
                    'specs/kinds/kinds.specification.ts spawns it by its path',
            },
            ignoreDependencies: {
                react: 'the website and mobile specimens of specs/kinds/ declare it, and their install links it from this checkout',
            },
        },
    },
});
