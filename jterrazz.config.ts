import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    presets: [test()],
    typescript: {
        mutation: {
            exclude: {
                'lint/self/corpus/audience.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
                'lint/self/corpus/refusals.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
                'specs/surface/package/builder-calls.test.ts':
                    'it reads the sources as text, and sees the instrumented ones',
            },
            ignore: {
                'lint/self/corpus/findings.ts':
                    'the self corpus audits the catalogue, and ships nowhere',
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
