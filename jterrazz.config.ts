import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: [test()],
    test: {
        projects: {
            cli: {
                include: [
                    'specs/cli/**/*.spec.ts',
                    'specs/kinds/**/*.spec.ts',
                    'specs/shapes/**/*.spec.ts',
                ],
                reason: 'the specimens of specs/kinds/ and specs/shapes/ run the packed command as the cli specs do; a run lays its fixtures under /tmp and packs the package once, and a packed install outlives the 30 s budget, and a specimen of specs/kinds/ installs a whole project of its kind and runs its gates, which on a loaded machine outlives 120 s',
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
                'specs/cli/__setup__/run-fresh-clone.ts':
                    'specs/cli/fresh-clone.specification.ts spawns it by its path',
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
                open: 'src/drivers/stryker/__tests__/headless.test.ts imports it from a child process it spawns, to prove the mutation sandbox refuses it',
                react: 'the website and mobile specimens of specs/kinds/ declare it, and their install links it from this checkout',
            },
        },
        roots: {
            vendor: 'carries the unpublished @jterrazz/test 17 that the v11 release installs, since test 17 peers on typescript ^11 and cannot publish first; the folder leaves once test 17 is on npm',
        },
    },
});
