import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { contextOf } from '../../../kit/checker/checker.js';
import { readCommandLine } from '../../../kit/checker/command-line.js';
import { basePresetsOf } from '../../catalogue/preset.js';
import { brokenLinks, rumdl } from '../markdown.rumdl.js';

const RUMDL = resolve(import.meta.dirname, '../../../../node_modules/.bin/rumdl');

const VALUED = ['--rumdl', '--rumdl-config'];

function repository(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'markdown-rumdl-'));
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: root });

    return root;
}

function contextAt(root: string, ...flags: string[]): ReturnType<typeof contextOf> {
    return contextOf(readCommandLine([root, ...flags], VALUED), basePresetsOf);
}

function printing(root: string, name: string, output: string): string {
    const binary = join(root, `${name}.sh`);
    writeFileSync(binary, `#!/bin/sh\nprintf '%s' '${output}'\n`);
    chmodSync(binary, 0o755);

    return binary;
}

describe('markdown.rumdl', () => {
    test('brokenLinks — the links rumdl finds broken — reports each at its place but one into a tree git ignores', () => {
        // Given - a page linking an ignored clone, a missing page by its anchor, a page outside the repository, and one that exists
        const root = repository({
            '.gitignore': 'work/\n',
            'README.md':
                '# Estate\n\nThe [clone](work/site/README.md), the [plan](notes/plan.md#part), the [parent](../parent.md), the [notes](notes.md).\n',
            'notes.md': '# Notes\n',
        });

        // Then - the missing page and the page outside are reported, whole
        expect(brokenLinks(contextAt(root, '--rumdl', RUMDL), ['README.md'])).toStrictEqual([
            {
                column: 46,
                line: 3,
                message: "Relative link 'notes/plan.md' does not exist",
                path: 'README.md',
                rule: 'markdown/link-resolves',
            },
            {
                column: 80,
                line: 3,
                message: "Relative link '../parent.md' does not exist",
                path: 'README.md',
                rule: 'markdown/link-resolves',
            },
        ]);
    });

    test('brokenLinks — no page, no runnable rumdl, or a report that is no list of warnings — reports nothing', () => {
        // Given - a repository, a rumdl that cannot run, and rumdls printing no JSON report
        const root = repository({ 'README.md': '# Estate\n\n[plan](plan.md)\n' });
        const warning = '{"file":"README.md","line":3,"column":1,"message":"a link to nothing"}';
        const reportOf = (binary: string, pages: readonly string[]): string[] =>
            brokenLinks(contextAt(root, '--rumdl', binary), pages).map(({ path }) => path);
        const crashed = printing(root, 'crashed', 'rumdl crashed');
        const single = printing(root, 'single', '{"file":"README.md"}');
        const mixed = printing(root, 'mixed', `[${warning},42,null,{"file":"x"},{"message":"y"}]`);

        // Then - only the well-formed warning of a mixed report is kept
        expect([
            reportOf(RUMDL, []),
            reportOf(join(root, 'absent'), ['README.md']),
            reportOf(crashed, ['README.md']),
            reportOf(single, ['README.md']),
            reportOf(mixed, ['README.md']),
        ]).toStrictEqual([[], [], [], [], ['README.md']]);
    });

    test('rumdl — the run that judges every other rule — leaves MD057 to the pass, takes the preset unless the project keeps a config, and fixes under fix', () => {
        // Given - a project with no rumdl config of its own, and one keeping a rumdl.toml
        const bare = repository({ 'README.md': '# A\n' });
        const own = repository({ 'README.md': '# A\n', 'rumdl.toml': '[global]\n' });
        const flags = ['--rumdl', RUMDL, '--rumdl-config', '/preset/rumdl.toml'];

        // Then - each run, whole
        expect([
            rumdl(contextAt(bare, ...flags), []),
            rumdl(contextAt(bare, ...flags), ['README.md']),
            rumdl(contextAt(own, ...flags, '--fix'), ['README.md', 'docs/a.md']),
        ]).toStrictEqual([
            [],
            [
                {
                    args: [
                        'check',
                        '--no-cache',
                        '--quiet',
                        '--extend-disable',
                        'MD057',
                        '--config',
                        '/preset/rumdl.toml',
                        'README.md',
                    ],
                    flag: '--rumdl',
                    name: 'rumdl',
                },
            ],
            [
                {
                    args: [
                        'check',
                        '--no-cache',
                        '--quiet',
                        '--extend-disable',
                        'MD057',
                        '--fix',
                        'README.md',
                        'docs/a.md',
                    ],
                    flag: '--rumdl',
                    name: 'rumdl',
                },
            ],
        ]);
    });
});
