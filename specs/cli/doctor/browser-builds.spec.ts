import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const doctor = cli.with({ env: { PLAYWRIGHT_BROWSERS_PATH: '$WORKDIR/cache' } });

// invariant: the project resolves a Playwright of its own, laid in the working directory, whose browsers file wants two Chromium builds.
function resolvingPlaywright(workdir: string): void {
    const core = join(workdir, 'node_modules/playwright-core');
    mkdirSync(core, { recursive: true });
    writeFileSync(join(core, 'package.json'), '{"name":"playwright-core","version":"1.0.0"}');
    writeFileSync(
        join(core, 'browsers.json'),
        JSON.stringify({
            browsers: [
                { name: 'chromium', revision: '1200' },
                { name: 'chromium-headless-shell', revision: '1201' },
            ],
        }),
    );
}

const HEAD = `
             TYPESCRIPT  Checking the toolchain...

            Toolchain versions
            {{any}}
            Every tool is in range.

            Pinned together

              vitest                      4.1.10
              @vitest/browser-playwright  4.1.10      ok


            Browsers
`;

function laidCache(...builds: string[]): (workdir: string) => void {
    return (workdir) => {
        for (const build of builds) {
            mkdirSync(join(workdir, 'cache', build), { recursive: true });
        }
    };
}

describe('browser-builds', () => {
    test('fails naming the Chromium builds the machine lacks', async () => {
        // Given - a project resolving a Playwright, and a cache holding the full build alone
        const result = await doctor
            .fixture(directory('./__fixtures__/browser-pin/matched/'))
            .prepare(resolvingPlaywright)
            .prepare(laidCache('chromium-1200'))
            .exec('doctor');

        // Then - one row per build, the headless shell missing, and the run refused with the fix
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`${HEAD}
              chromium                    r1200      installed
              chromium-headless-shell     r1201      missing

            found: the machine lacks chromium-headless-shell r1201, which the Playwright this project resolves launches · why: a browser project fails at launch on a revision the machine does not hold, and several Playwright revisions on one machine each need their own build · fix: run \`npx playwright install chromium\` in the project, then \`typescript doctor\` again · read: docs/guides/adopt-a-stricter-release.md#the-browser-build-on-the-machine

            Resolved studio.config.ts

            {{any}}
        `);
    });

    test('passes once every build is on the machine', async () => {
        // Given - the same project and a cache holding both builds
        const result = await doctor
            .fixture(directory('./__fixtures__/browser-pin/matched/'))
            .prepare(resolvingPlaywright)
            .prepare(laidCache('chromium-1200', 'chromium_headless_shell-1201'))
            .exec('doctor');

        // Then - both rows installed, and nothing owed
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`${HEAD}
              chromium                    r1200      installed
              chromium-headless-shell     r1201      installed


            Resolved studio.config.ts

            {{any}}
        `);
    });
});
