import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OxlintConfig } from 'oxlint';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { SETTINGS_FILE } from '../../../lint/kit/project/jterrazz-config.js';
import { originLines } from '../../../lint/kit/project/origins.js';
import type { Resolved } from '../../../lint/kit/project/preset.js';
import { toolVersions } from '../../../lint/kit/project/tool-versions.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { badge, print } from '../check/report/terminal.js';
import { reportBrowsers } from './browsers.js';
import { derivedOf } from './derived.js';
import { reportPinnedPair } from './pinned-pair.js';

const NODE_MODULES = '/node_modules/';

// invariant: a plugin the rulebook resolves from its own install is named inside the package that ships it, the same on every machine.
async function shownProfile({ declaration }: Resolved): Promise<OxlintConfig> {
    // hazard: the rulebook resolves its JS plugins as it loads, so it loads when the doctor prints it, never as the command line starts every other command.
    const { rulebookProfileOf } = await import('../../../lint/index.rulebook.js');
    const rulebook = rulebookProfileOf(declaration?.platform ?? 'node');

    return {
        ...rulebook,
        jsPlugins: (rulebook.jsPlugins ?? []).map((plugin) =>
            // Stryker disable next-line ConditionalExpression: every JS plugin the rulebook names is a path
            typeof plugin === 'string' && plugin.includes(NODE_MODULES)
                ? plugin.slice(plugin.lastIndexOf(NODE_MODULES) + NODE_MODULES.length)
                : plugin,
        ),
    };
}

async function reportConfig(root: string): Promise<void> {
    for (const unit of ['.', ...workspaceMembers(root)]) {
        const { problem, resolved } = await readSettings(join(root, unit));
        const file = unit === '.' ? SETTINGS_FILE : `${unit}/${SETTINGS_FILE}`;
        print(`\nResolved ${file}\n\n`);
        if (problem !== null) {
            print(`  ${file} ${problem}\n`);
            continue;
        }
        const lines = originLines(resolved, {
            derived: derivedOf(join(root, unit), resolved),
            holds: (folder) => existsSync(join(root, unit, folder)),
            rulebook: await shownProfile(resolved),
        });
        const width = Math.max(...lines.map(({ origin }) => origin.length)) + 2;
        for (const { origin, setting } of lines) {
            print(`  ${origin.padEnd(width)}${setting}\n`);
        }
    }
}

export async function doctor(root: string): Promise<number> {
    print(`${badge('TYPESCRIPT')} Checking the toolchain...\n\n`);
    const rows = toolVersions();
    const failed = rows.some(({ verdict }) => verdict === 'old' || verdict === 'absent');
    const warned = rows.some(({ verdict }) => verdict === 'newer');

    print('Toolchain versions\n\n');

    const nameWidth = Math.max(...rows.map(({ name }) => name.length)) + 2;
    for (const { installed, name, range, verdict } of rows) {
        print(
            `  ${name.padEnd(nameWidth)}${(installed ?? '—').padEnd(12)}${range.padEnd(12)}${verdict}\n`,
        );
    }

    // Stryker disable next-line StringLiteral,CallExpression: a blank line between the table and its verdict, which no reader parses
    print('\n');

    if (failed) {
        print(
            `${refusal({
                fix: 'install what this release declares, then run `typescript doctor` again',
                found: 'a tool is older than its range, or not installed — its row reads `old` or `absent`',
                read: 'docs/guides/adopt-a-stricter-release.md#the-two-gestures',
                why: 'a gate running an older tool enforces an older rulebook without saying so',
            })}\n`,
        );
    } else if (warned) {
        print('A tool ahead of its range may be fine; the toolchain does not get to decide.\n');
    } else {
        print('Every tool is in range.\n');
    }

    const skewed = reportPinnedPair(root);
    const missing = reportBrowsers(root);
    await reportConfig(root);

    return failed || skewed || missing ? 1 : 0;
}
