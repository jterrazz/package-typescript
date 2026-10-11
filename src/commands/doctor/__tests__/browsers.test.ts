import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { browsersCache, chromiumBuilds } from '../browsers.js';

const at = (environment: Record<string, string>, platform: string): string =>
    browsersCache(environment, platform, '/home/me', '/project/node_modules/playwright-core');

describe('browsers', () => {
    test('browsersCache — the cache is the one the environment names, else the platform’s own', () => {
        // Given - the same home, the variable stated, empty and zero, and each platform bare
        // Then - the variable wins, zero keeps the browsers inside Playwright, and a bare platform reads its cache folder
        expect([
            at({ PLAYWRIGHT_BROWSERS_PATH: '/shared' }, 'linux'),
            at({ PLAYWRIGHT_BROWSERS_PATH: '0' }, 'linux'),
            at({ PLAYWRIGHT_BROWSERS_PATH: '' }, 'darwin'),
            at({}, 'darwin'),
            at({ XDG_CACHE_HOME: '/xdg' }, 'linux'),
            at({}, 'linux'),
            at({ LOCALAPPDATA: String.raw`C:\Local` }, 'win32'),
        ]).toStrictEqual([
            '/shared',
            '/project/node_modules/playwright-core/.local-browsers',
            '/home/me/Library/Caches/ms-playwright',
            '/home/me/Library/Caches/ms-playwright',
            '/xdg/ms-playwright',
            '/home/me/.cache/ms-playwright',
            join(String.raw`C:\Local`, 'ms-playwright'),
        ]);
    });

    test('chromiumBuilds — names each Chromium build the resolved Playwright launches and whether the machine holds it, and nothing where no Playwright resolves', () => {
        // Given - a project resolving a Playwright that wants two Chromium builds and a Firefox, one build in the cache, and a project resolving none
        const root = mkdtempSync(join(tmpdir(), 'doctor-browsers-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const core = join(root, 'with/node_modules/playwright-core');
        mkdirSync(core, { recursive: true });
        writeFileSync(join(root, 'with/package.json'), '{}');
        writeFileSync(join(core, 'package.json'), '{"name":"playwright-core","version":"1.0.0"}');
        writeFileSync(
            join(core, 'browsers.json'),
            JSON.stringify({
                browsers: [
                    { name: 'chromium', revision: '1200' },
                    { name: 'chromium-headless-shell', revision: '1201' },
                    { name: 'firefox', revision: '1300' },
                ],
            }),
        );
        mkdirSync(join(root, 'cache/chromium-1200'), { recursive: true });
        vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));
        mkdirSync(join(root, 'without'), { recursive: true });
        writeFileSync(join(root, 'without/package.json'), '{}');

        // Then - the two Chromium builds with the one the machine holds, nothing of Firefox, and nothing for the project without Playwright
        expect([
            chromiumBuilds(join(root, 'with')),
            chromiumBuilds(join(root, 'without')),
        ]).toStrictEqual([
            [
                {
                    directory: join(root, 'cache/chromium-1200'),
                    installed: true,
                    name: 'chromium',
                    revision: '1200',
                },
                {
                    directory: join(root, 'cache/chromium_headless_shell-1201'),
                    installed: false,
                    name: 'chromium-headless-shell',
                    revision: '1201',
                },
            ],
            undefined,
        ]);
    });
});
