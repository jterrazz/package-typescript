import { defineSpecConfig, unit } from '@jterrazz/test/vitest';
import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';

// Stryker 10 names a test by its suites and title joined with a space, where Vitest 5 joins them with ` > `: without this, every mutant runs no test and survives.
const strykerTestNames: Plugin = {
    configureVitest({ project }) {
        let pattern: RegExp | undefined;
        Object.defineProperty(project.config, 'testNamePattern', {
            configurable: true,
            enumerable: true,
            get: () => pattern,
            set: (stated: RegExp | string | undefined) => {
                pattern =
                    stated === undefined
                        ? undefined
                        : new RegExp(
                              (stated instanceof RegExp ? stated.source : stated)
                                  .replaceAll(String.raw`\-`, '-')
                                  .replaceAll(' ', '(?: > | )'),
                              'u',
                          );
            },
        });
    },
    name: 'stryker-test-names',
};

export default defineSpecConfig({
    test: {
        projects: [
            mergeConfig(
                unit({
                    // What reads the sources as text sees the instrumented ones, and cannot judge a mutant.
                    exclude: [
                        '**/*.test.tsx',
                        'lint/self/corpus/audience.test.ts',
                        'lint/self/corpus/refusals.test.ts',
                        'specs/surface/package/builder-calls.test.ts',
                    ],
                    include: [
                        'lint/**/*.test.ts',
                        'specs/surface/**/*.test.ts',
                        'src/**/*.test.ts',
                    ],
                }),
                { plugins: [strykerTestNames] },
            ),
        ],
    },
});
