import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { print } from '../check/report/terminal.js';
import { declaredAnywhere } from './declared.js';

export type BrowserBuild = {
    directory: string;
    installed: boolean;
    name: string;
    revision: string;
};

// outside: Playwright keeps one folder per browser build in its cache, named for the build and its revision; a Playwright whose revision the machine lacks fails every browser project at launch.
const FOLDERS: Readonly<Record<string, string>> = {
    chromium: 'chromium',
    'chromium-headless-shell': 'chromium_headless_shell',
};

/** The folder Playwright keeps its browsers in: the one `PLAYWRIGHT_BROWSERS_PATH` names, else its default for the platform. */
export function browsersCache(
    environment: Readonly<Record<string, string | undefined>>,
    platform: string,
    home: string,
    playwright: string,
): string {
    const stated = environment.PLAYWRIGHT_BROWSERS_PATH;
    if (stated === '0') {
        return join(playwright, '.local-browsers');
    }
    if (stated !== undefined && stated !== '') {
        return stated;
    }
    if (platform === 'darwin') {
        return join(home, 'Library', 'Caches', 'ms-playwright');
    }
    if (platform === 'win32') {
        return join(environment.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'ms-playwright');
    }

    return join(environment.XDG_CACHE_HOME ?? join(home, '.cache'), 'ms-playwright');
}

/** The Chromium builds the Playwright a project resolves needs, and whether the machine holds each; `undefined` where the project resolves no Playwright. */
export function chromiumBuilds(root: string): BrowserBuild[] | undefined {
    let manifest: string;
    try {
        manifest = createRequire(join(root, 'package.json')).resolve(
            'playwright-core/browsers.json',
        );
    } catch {
        return undefined;
    }
    // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
    const { browsers } = parsedObject(readFileSync(manifest, 'utf8'));
    const cache = browsersCache(process.env, process.platform, homedir(), dirname(manifest));

    // Stryker disable next-line ArrayDeclaration: a stand-in entry is a string, which has no name, so it names no build whatever text it holds
    return (Array.isArray(browsers) ? browsers : []).flatMap((entry): BrowserBuild[] => {
        const { name, revision } = objectOf(entry);
        // Stryker disable next-line ConditionalExpression: a name that is no string keys no folder, so the lookup answers undefined either way
        const folder = typeof name === 'string' ? FOLDERS[name] : undefined;
        // Stryker disable next-line ConditionalExpression: a folder was found only for a string name; the check is the narrowing the type asks for
        if (folder === undefined || typeof name !== 'string' || typeof revision !== 'string') {
            return [];
        }
        const directory = join(cache, `${folder}-${revision}`);

        return [{ directory, installed: existsSync(directory), name, revision }];
    });
}

// invariant: a project that declares Playwright and resolves it owes the machine the Chromium build that Playwright launches; a revision the machine lacks fails every browser project at launch, and `doctor` is where it reads before a run.
export function reportBrowsers(root: string): boolean {
    const declared = ['playwright', 'playwright-core', '@vitest/browser-playwright'].some((name) =>
        declaredAnywhere(root, name),
    );
    const builds = declared ? chromiumBuilds(root) : undefined;
    if (builds === undefined || builds.length === 0) {
        return false;
    }
    print('\nBrowsers\n\n');
    for (const { installed, name, revision } of builds) {
        print(
            `  ${name.padEnd(28)}r${revision.padEnd(10)}${installed ? 'installed' : 'missing'}\n`,
        );
    }
    print('\n');
    const missing = builds.filter(({ installed }) => !installed);
    if (missing.length > 0) {
        print(
            `${refusal({
                fix: 'run `npx playwright install chromium` in the project, then `typescript doctor` again',
                found: `the machine lacks ${missing.map(({ name, revision }) => `${name} r${revision}`).join(', ')}, which the Playwright this project resolves launches`,
                read: 'docs/guides/adopt-a-stricter-release.md#the-browser-build-on-the-machine',
                why: 'a browser project fails at launch on a revision the machine does not hold, and several Playwright revisions on one machine each need their own build',
            })}\n`,
        );
    }

    return missing.length > 0;
}
