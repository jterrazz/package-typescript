import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../check-passes.js';
import { cli } from '../cli.specification.js';
import { temporaryDirectory } from '../temporary-directory.js';

// The oracle is oxlint's own report over a copy of the same ground in the same environment.

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const OXLINT = resolve(REPOSITORY, 'node_modules/.bin/oxlint');
const SHAPES = resolve(import.meta.dirname, '_fixtures/oxlint-report');

const FORM_VARIABLES = [
    'AI_AGENT',
    'CI',
    'CLAUDECODE',
    'CLAUDE_CODE',
    'CODEX_SANDBOX',
    'CODEX_THREAD_ID',
    'COPILOT_CLI',
    'CURSOR_AGENT',
    'FORCE_COLOR',
    'GEMINI_CLI',
    'GITHUB_ACTIONS',
    'JUNIE_DATA',
    'JUNIE_SHIM_PATH',
    'NO_COLOR',
    'OPENCODE',
    'REPL_ID',
];

function formOnly(form: Record<string, string>): Record<string, null | string> {
    return { ...Object.fromEntries(FORM_VARIABLES.map((variable) => [variable, null])), ...form };
}

function oxlintAlone(form: Record<string, string>): string {
    const project = temporaryDirectory('spec-oxlint-report-');
    cpSync(SHAPES, project, { recursive: true });
    const kept = Object.entries(process.env).filter(
        ([variable]) => !FORM_VARIABLES.includes(variable),
    );
    const linted = spawnSync(OXLINT, ['--type-aware', '--deny-warnings', 'index.ts', 'shapes.ts'], {
        cwd: project,
        encoding: 'utf8',
        env: {
            ...Object.fromEntries(kept),
            ...form,
            PATH: `${resolve(REPOSITORY, 'node_modules/.bin')}:${process.env.PATH ?? ''}`,
        },
    });

    return linted.stdout;
}

// A run's duration is the one thing two runs of the same lint never share.
function timeless(text: string): string {
    return text.replaceAll(/Finished in \d+(?:ms|\.\d+s)/gu, 'Finished in <time>');
}

function oxlintPassOf(stdout: string): string {
    const opened = stdout.slice(stdout.indexOf('Oxlint Check\n\n') + 'Oxlint Check\n\n'.length);

    return opened.slice(
        0,
        opened.search(/^\S+\/\S+ {2}\d+ diagnostic\(s\), and the project keeps no baseline$/mu),
    );
}

describe('oxlint-report', () => {
    test.each([
        {
            form: {},
            marker: ',-[shapes.ts:',
            name: 'the framed report, where nothing forces colour',
        },
        {
            form: { FORCE_COLOR: '1' },
            marker: '╭─[',
            name: 'the framed report in colour, where FORCE_COLOR asks for it',
        },
        {
            form: { AI_AGENT: 'spec' },
            marker: 'shapes.ts:2:23: error eslint(no-dupe-keys)',
            name: 'one line per diagnostic, under an AI agent',
        },
        {
            form: { GITHUB_ACTIONS: 'true' },
            marker: '::error file=shapes.ts,',
            name: 'workflow commands, on a GitHub runner',
        },
    ])(
        'prints what oxlint prints, drawn from its JSON report — $name',
        async ({ form, marker }) => {
            // Given - a project whose one file breaks a rule of every frame shape, and oxlint's own report on it
            const expected = oxlintAlone(form);

            // When - the quality checks run there, in the same environment
            const result = await cli
                .env({ ...formOnly(form), ...onlyPasses('oxlint') })
                .fixture(directory('./_fixtures/oxlint-report/'))
                .exec('check');

            // Then - the pass prints oxlint's own report, byte for byte but the run's duration, in the form this environment picks
            expect(expected).toContain(marker);
            expect(timeless(oxlintPassOf(result.stdout.raw))).toBe(timeless(expected));
        },
    );

    // A JS plugin records every oxlint process loading it in the file `RUNS_LOG` names, and nowhere without one.
    test.each([
        { held: false, name: 'a failing pass with no baseline to judge it' },
        { held: true, name: 'a pass the baseline holds' },
    ])(
        'lints the project once, for the report every reader of the pass reads — $name',
        async ({ held }) => {
            // Given - a project whose oxlint config loads a plugin that counts the linter runs
            const project = cli
                .env({ RUNS_LOG: '$WORKDIR/runs.log' })
                .fixture(directory('./_fixtures/oxlint-once/project/'));
            const counted = held
                ? project.fixture(directory('./_fixtures/oxlint-once/held/'))
                : project;

            // When - the quality checks run there
            const result = await counted.exec('check');

            // Then - one oxlint process linted the project; the other loads of the config only printed it
            const runs = result.file('runs.log').content.split('\n');
            expect(runs.filter((run) => run.includes('--type-aware'))).toStrictEqual([
                expect.stringContaining('--type-aware --deny-warnings --format json'),
            ]);
        },
    );
});
