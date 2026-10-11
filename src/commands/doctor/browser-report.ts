import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { print } from '../check/report/terminal.js';
import { chromiumBuilds } from './browsers.js';
import { declaredAnywhere } from './declared.js';

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
