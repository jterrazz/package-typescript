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
        mutation: {
            presentation: {
                'src/commands/check/report/**':
                    'the check specs of specs/cli/check/ compare what the gate prints whole, against their __expected__/ goldens',
                'src/commands/doctor/**':
                    'the doctor specs of specs/cli/doctor/ compare what it prints whole, resolved-config.spec.yaml first',
                'src/commands/mutation/refused.ts':
                    'specs/cli/typescript/mutation.spec.ts and the documents of specs/cli/mutation/ compare each refusal it prints whole',
                'src/commands/mutation/uncompiled.ts':
                    'specs/cli/typescript/mutation-made.spec.ts compares the refusal it prints whole',
                'src/commands/mutation/verdict.ts':
                    'specs/cli/typescript/mutation.spec.ts compares each verdict it prints whole',
            },
        },
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
    },
});
