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
                reason: 'the specimens of specs/kinds/ run the packed command as the cli specs do; a run lays its fixtures under /tmp and packs the package once, and a packed install outlives the 30 s budget, and a specimen of specs/kinds/ installs a whole project of its kind and runs its gates, which on a loaded machine outlives 120 s',
                setup: [
                    'specs/cli/__setup__/run-temp-root.ts',
                    'specs/cli/__setup__/packed/per-run.ts',
                ],
                timeout: 300_000,
            },
        },
    },
    typescript: {
        knip: {
            entry: {
                'specs/cli/__setup__/packed/consumer.ts':
                    'specs/cli/packed-cli.specification.ts spawns it by its path',
                'specs/cli/__setup__/run-hoisted-baseline.ts':
                    'specs/cli/hoisted-baseline.specification.ts spawns it by its path',
                'specs/cli/__setup__/run-install-matrix.ts':
                    'specs/cli/install-matrix.specification.ts spawns it by its path',
                'specs/cli/__setup__/run-split-install.ts':
                    'specs/cli/resolution.specification.ts spawns it by its path',
                'specs/cli/__setup__/run-strict-install.ts':
                    'specs/cli/strict-install.specification.ts spawns it by its path',
                'specs/kinds/__setup__/specimen.ts':
                    'specs/kinds/kinds.specification.ts spawns it by its path',
            },
            ignoreDependencies: {
                react: 'the website and mobile specimens of specs/kinds/ declare it, and their install links it from this checkout',
            },
        },
    },
});
