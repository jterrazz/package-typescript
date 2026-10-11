import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';

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
    const { browsers } = parsedObject(readFileSync(manifest, 'utf8'));
    const cache = browsersCache(process.env, process.platform, homedir(), dirname(manifest));

    return (Array.isArray(browsers) ? browsers : []).flatMap((entry): BrowserBuild[] => {
        const { name, revision } = objectOf(entry);
        const folder = typeof name === 'string' ? FOLDERS[name] : undefined;
        if (folder === undefined || typeof name !== 'string' || typeof revision !== 'string') {
            return [];
        }
        const directory = join(cache, `${folder}-${revision}`);

        return [{ directory, installed: existsSync(directory), name, revision }];
    });
}
