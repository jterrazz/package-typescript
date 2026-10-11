import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { reportBrowsers } from '../browser-report.js';

const project = (
    root: string,
    name: string,
    { browsers, declares }: { browsers: unknown[]; declares: string[] },
): string => {
    const folder = join(root, name);
    const core = join(folder, 'node_modules/playwright-core');
    mkdirSync(core, { recursive: true });
    const devDependencies = Object.fromEntries(declares.map((one) => [one, '*']));
    writeFileSync(join(folder, 'package.json'), JSON.stringify({ devDependencies }));
    writeFileSync(join(core, 'package.json'), '{"name":"playwright-core","version":"1.0.0"}');
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
const cacheRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-report-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', join(root, 'cache'));

    return root;
};

const BUILDS = [
    { name: 'chromium', revision: '1200' },
    { name: 'chromium-headless-shell', revision: '1201' },
];

describe('reportBrowsers', () => {
    test('reportBrowsers — a project that declares any Playwright package and resolves one is held to its builds, and one that declares none is not', () => {
        // Given - one project per package that declares it, one declaring none, all resolving a Playwright that wants two builds the cache lacks
        const root = cacheRoot();
        const names = ['playwright', 'playwright-core', '@vitest/browser-playwright'];
        const declaring = names.map((name) =>
            project(root, name.replace('/', '-'), { browsers: BUILDS, declares: [name] }),
        );
        const none = project(root, 'none', { browsers: BUILDS, declares: ['vitest'] });

        // Then - each declaring project fails on its missing builds, the other prints nothing and passes
        const failures = declaring.map((folder) => printed(() => reportBrowsers(folder)));
        expect(failures.map(({ failed }) => failed)).toStrictEqual([true, true, true]);
        expect(printed(() => reportBrowsers(none))).toStrictEqual({ failed: false, text: '' });
    });

    test('reportBrowsers — names every build as installed or missing, and the refusal names each missing one with its revision', () => {
        // Given - a project whose cache holds the Chromium and lacks the headless shell
        const root = cacheRoot();
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
        const root = cacheRoot();
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
