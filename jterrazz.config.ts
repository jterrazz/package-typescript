import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: [test()],
    test: {
        projects: [
            {
                exclude: ['**/*.test.tsx'],
                facet: 'unit',
                include: ['lint/**/*.test.ts', 'specs/surface/**/*.test.ts', 'src/**/*.test.ts'],
                isolate: false,
            },
            { facet: 'lint' },
            {
                facet: 'cli',
                setup: ['specs/cli/_setup/run-temp-root.ts', 'specs/cli/_setup/packed/per-run.ts'],
                timeout: 120_000,
            },
        ],
    },
    typescript: {
        mutation: {
            mutate: {
                'lint/*.ts': 'the entries of the lint rules the package ships',
                'lint/consumer/**/*.ts':
                    'the lint rules the package ships, beside the src/ every node project measures',
                'lint/kit/**/*.ts': 'the rules kit the package ships to the rules of its siblings',
            },
            exclude: {
                'lint/self/corpus/audience.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
                'lint/self/corpus/refusals.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
                'specs/surface/package/builder-calls.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
            },
        },
        knip: {
            ignoreDependencies: {
                '@stryker-mutator/vitest-runner':
                    'Stryker loads the runner `typescript mutation` hands it by path, which knip cannot trace',
            },
            entry: {
                'specs/cli/_setup/check-selection.ts':
                    'the command the cli specs spawn by path, selecting the passes a spec reads',
            },
        },
    },
});
