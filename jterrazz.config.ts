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
            unit: {
                isolate: false,
                reason: 'the module tests leave no state behind in a module, so a worker runs its files in one module graph',
            },
        },
    },
    typescript: {
        mutation: {
            exclude: {
                'specs/surface/package/documented-examples.test.ts':
                    'it type-checks against the built declarations, which an instrumented build infers wider',
                'specs/cli/tsc/declarations.spec.ts':
                    'it type-checks against the built declarations, which an instrumented build infers wider',
            },
        },
        knip: {
            ignoreDependencies: {
                '@types/react':
                    'the website and mobile specimens of specs/kinds/ declare it, and their install links it from this checkout',
                react: 'the website and mobile specimens of specs/kinds/ declare it, and their install links it from this checkout',
            },
        },
    },
});
