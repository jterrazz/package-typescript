import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('browser-pin', () => {
    test('passes a lockfile that resolves both to the same version', async () => {
        // Given - a project whose lockfile pins the provider at vitest's own version
        const result = await cli
            .fixture(directory('./__fixtures__/browser-pin/matched/'))
            .exec('doctor');

        // Then - both are named at one version, and nothing is owed
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              vitest                      4.1.10
              @vitest/browser-playwright  4.1.10      ok


            Resolved jterrazz.config.ts

            {{any}}`);
    });

    test('fails a lockfile one patch apart, naming both versions', async () => {
        // Given - the same project with the provider a patch behind the runner
        const result = await cli
            .fixture(directory('./__fixtures__/browser-pin/skewed/'))
            .exec('doctor');

        // Then - the report names both numbers and says what the pin owes
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              vitest                      4.1.10
              @vitest/browser-playwright  4.1.9       skewed

            found: @vitest/browser-playwright 4.1.9 is not vitest 4.1.10 · why: @vitest/browser-playwright is versioned with vitest and must equal it exactly: a patch apart loads a second copy of its internals · fix: pin both to the same version · read: docs/guides/adopt-a-stricter-release.md#the-provider-pinned-to-its-runner

            Resolved jterrazz.config.ts

            {{any}}
        `);
    });

    test('reads a bun.lock, trailing commas and all', async () => {
        // Given - a bun workspace whose provider resolved a patch behind the runner
        const result = await cli
            .fixture(directory('./__fixtures__/browser-pin/bun-skewed/'))
            .exec('doctor');

        // Then - the pin is checked, not passed over: bun.lock is JSON once the commas go
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              vitest                      4.1.10
              @vitest/browser-playwright  4.1.9       skewed

            found: @vitest/browser-playwright 4.1.9 is not vitest 4.1.10 · why: @vitest/browser-playwright is versioned with vitest and must equal it exactly: a patch apart loads a second copy of its internals · fix: pin both to the same version · read: docs/guides/adopt-a-stricter-release.md#the-provider-pinned-to-its-runner

            Resolved jterrazz.config.ts

            {{any}}
        `);
    });

    test('says so where the lockfile is one it does not parse', async () => {
        // Given - a project declaring the provider under a lockfile this report cannot read
        const result = await cli
            .fixture(directory('./__fixtures__/browser-pin/unread/'))
            .exec('doctor');

        // Then - the gap is stated rather than passed over, and it fails nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              @vitest/browser-playwright  pnpm-lock.yaml is not parsed here, so the pin is unchecked


            Resolved jterrazz.config.ts

            {{any}}`);
    });

    test('states the gap for a provider declared by a member rather than the root', async () => {
        // Given - a workspace whose root declares nothing and whose member runs browser mode
        const result = await cli
            .fixture(directory('./__fixtures__/browser-pin/unread-member/'))
            .exec('doctor');

        // Then - the notice fires: the provider belongs to whichever package runs browser mode
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              @vitest/browser-playwright  pnpm-lock.yaml is not parsed here, so the pin is unchecked


            Resolved jterrazz.config.ts

            {{any}}`);
    });
});
