import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { browsersCache, chromiumBuilds, reportBrowsers } from '../browsers.js';

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

    test('chromiumBuilds — reads only well-formed Chromium entries of a manifest: a browsers list that is no list, a name or a revision that is no string, and a browser of another family name none', () => {
        // Given - a Playwright whose browsers file lists a Chromium by number, a nameless entry, a WebKit, and one well-formed headless shell; and one whose browsers is a word
        const root = mkdtempSync(join(tmpdir(), 'doctor-browsers-odd-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const writeProject = (name: string, browsers: unknown): string => {
            const project = join(root, name);
            const core = join(project, 'node_modules/playwright-core');
            mkdirSync(core, { recursive: true });
            writeFileSync(join(project, 'package.json'), '{}');
            writeFileSync(
                join(core, 'package.json'),
                '{"name":"playwright-core","version":"1.0.0"}',
            );
            writeFileSync(join(core, 'browsers.json'), JSON.stringify({ browsers }));

            return project;
        };
        vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));
        const odd = writeProject('odd', [
            { name: 'chromium', revision: 1200 },
            { revision: '1' },
            { name: 'chromium' },
            { name: 'webkit', revision: '2000' },
            { name: 'chromium-headless-shell', revision: '1201' },
            'chromium',
        ]);
        const word = writeProject('word', 'chromium');

        // Then - the one well-formed entry alone is read, and a browsers file that holds no list names nothing
        expect([chromiumBuilds(odd)?.map(({ name }) => name), chromiumBuilds(word)]).toStrictEqual([
            ['chromium-headless-shell'],
            [],
        ]);
    });

    describe('reportBrowsers', () => {
        const project = (
            root: string,
            name: string,
            { browsers, declares }: { browsers: unknown[]; declares: string[] },
        ): string => {
            const folder = join(root, name);
            const core = join(folder, 'node_modules/playwright-core');
            mkdirSync(core, { recursive: true });
            writeFileSync(
                join(folder, 'package.json'),
                JSON.stringify({
                    devDependencies: Object.fromEntries(declares.map((one) => [one, '*'])),
                }),
            );
            writeFileSync(
                join(core, 'package.json'),
                '{"name":"playwright-core","version":"1.0.0"}',
            );
            writeFileSync(join(core, 'browsers.json'), JSON.stringify({ browsers }));

            return folder;
        };
        const printed = (work: () => boolean): { failed: boolean; text: string } => {
            const chunks: string[] = [];
            vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
                chunks.push(String(chunk));
                return true;
            });
            const failed = work();
            vi.restoreAllMocks();

            return { failed, text: chunks.join('') };
        };
        const BUILDS = [
            { name: 'chromium', revision: '1200' },
            { name: 'chromium-headless-shell', revision: '1201' },
        ];

        test('reportBrowsers — a project that declares any Playwright package and resolves one is held to its builds, and one that declares none is not', () => {
            // Given - one project per package that declares it, one declaring none, all resolving a Playwright that wants two builds the cache lacks
            const root = mkdtempSync(join(tmpdir(), 'doctor-report-'));
            onTestFinished(() => {
                rmSync(root, { force: true, recursive: true });
            });
            vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));
            const names = ['playwright', 'playwright-core', '@vitest/browser-playwright'];
            const declaring = names.map((name) =>
                project(root, name.replace('/', '-'), { browsers: BUILDS, declares: [name] }),
            );
            const none = project(root, 'none', { browsers: BUILDS, declares: ['vitest'] });

            // Then - each declaring project fails on its missing builds, the other prints nothing and passes
            expect(
                declaring.map((folder) => printed(() => reportBrowsers(folder)).failed),
            ).toStrictEqual([true, true, true]);
            expect(printed(() => reportBrowsers(none))).toStrictEqual({ failed: false, text: '' });
        });

        test('reportBrowsers — names every build as installed or missing, and the refusal names each missing one with its revision', () => {
            // Given - a project whose cache holds the Chromium and lacks the headless shell
            const root = mkdtempSync(join(tmpdir(), 'doctor-report-'));
            onTestFinished(() => {
                rmSync(root, { force: true, recursive: true });
            });
            vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));
            mkdirSync(join(root, 'cache/chromium-1200'), { recursive: true });
            const folder = project(root, 'one', { browsers: BUILDS, declares: ['playwright'] });
            const both = project(root, 'both', {
                browsers: [...BUILDS, { name: 'chromium', revision: '1300' }],
                declares: ['playwright'],
            });

            // Then - the table, then the refusal with the one missing build; and with two missing, both joined by a comma
            const one = printed(() => reportBrowsers(folder));
            expect(one.failed).toBe(true);
            expect(one.text).toContain(
                '\nBrowsers\n\n  chromium                    r1200      installed\n  chromium-headless-shell     r1201      missing\n\n',
            );
            expect(one.text).toContain(
                'found: the machine lacks chromium-headless-shell r1201, which the Playwright this project resolves launches',
            );
            expect(printed(() => reportBrowsers(both)).text).toContain(
                'the machine lacks chromium-headless-shell r1201, chromium r1300, which',
            );
        });

        test('reportBrowsers — a project whose Playwright wants no Chromium prints nothing, and one with every build passes', () => {
            // Given - a Playwright listing only Firefox, and one whose two builds are both on the machine
            const root = mkdtempSync(join(tmpdir(), 'doctor-report-'));
            onTestFinished(() => {
                rmSync(root, { force: true, recursive: true });
            });
            vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));
            mkdirSync(join(root, 'cache/chromium-1200'), { recursive: true });
            mkdirSync(join(root, 'cache/chromium_headless_shell-1201'), { recursive: true });
            const firefox = project(root, 'firefox', {
                browsers: [{ name: 'firefox', revision: '1300' }],
                declares: ['playwright'],
            });
            const full = project(root, 'full', { browsers: BUILDS, declares: ['playwright'] });

            // Then - nothing for the first, the table and no refusal for the second
            expect(printed(() => reportBrowsers(firefox))).toStrictEqual({
                failed: false,
                text: '',
            });
            const passed = printed(() => reportBrowsers(full));
            expect(passed.failed).toBe(false);
            expect(passed.text).toContain('installed');
            expect(passed.text).not.toContain('found:');
        });
    });
});
