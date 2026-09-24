import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * The product through its runner, and oxlint beside it as the oracle: the
 * claim is that the Oxlint pass prints what oxlint itself prints in the same
 * place, so the expected value is oxlint's own report, made over a copy of the
 * same ground in the same environment — which no document can state.
 */

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const BIN = resolve(REPOSITORY, 'bin/typescript.sh');
const OXLINT = resolve(REPOSITORY, 'node_modules/.bin/oxlint');
const SHAPES = resolve(import.meta.dirname, 'fixtures/oxlint-report');

/** The environment variables oxlint reads to pick its form, cleared before each case sets its own. */
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

/** A case's form variables, every other one unset. */
function formOnly(form: Record<string, string>): Record<string, null | string> {
    return { ...Object.fromEntries(FORM_VARIABLES.map((variable) => [variable, null])), ...form };
}

/** oxlint alone over a copy of the fixture, in this environment with the case's form variables. */
function oxlintAlone(form: Record<string, string>): string {
    const project = mkdtempSync(resolve(tmpdir(), 'spec-oxlint-report-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
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

/** A run's duration, the one thing two runs of the same lint never share. */
function timeless(text: string): string {
    return text.replaceAll(/Finished in \d+(?:ms|\.\d+s)/gu, 'Finished in <time>');
}

/** What the Oxlint pass printed between its header and the ratchet's first line. */
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
                .env(formOnly(form))
                .fixture(directory('./fixtures/oxlint-report/'))
                .exec('check');

            // Then - the pass prints oxlint's own report, byte for byte but the run's duration, in the form this environment picks
            expect(expected).toContain(marker);
            expect(timeless(oxlintPassOf(result.stdout.raw))).toBe(timeless(expected));
        },
    );

    /*
     * The run count needs a ground no fixture can be: oxlint loads every config
     * under this repository, fixtures included, so a committed config loading
     * this plugin would count — and write — during this repository's own lint
     * run. The project is built in a temp directory, and the product started on it.
     */

    /** A JS plugin that writes one line per oxlint process that loads it: the arguments it was started with. */
    const COUNTING_PLUGIN = [
        "import { appendFileSync } from 'node:fs';",
        '',
        String.raw`appendFileSync(new URL('./runs.log', import.meta.url), process.argv.slice(2).join(' ') + '\n');`,
        '',
        "export default { meta: { name: 'counting' }, rules: {} };",
        '',
    ].join('\n');

    /** A project with one `debugger` armed at error, whose config loads the counting plugin. */
    function countedProject(baseline: null | string): string {
        const project = mkdtempSync(resolve(tmpdir(), 'spec-oxlint-once-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        writeFileSync(join(project, 'counting.js'), COUNTING_PLUGIN);
        writeFileSync(
            join(project, 'index.ts'),
            'export function paused(): void {\n    debugger;\n}\n',
        );
        writeFileSync(
            join(project, 'oxlint.config.ts'),
            'export default { jsPlugins: ["./counting.js"], rules: { "no-debugger": "error" } };\n',
        );
        writeFileSync(
            join(project, 'package.json'),
            `${JSON.stringify({ name: 'spec-oxlint-once', private: true, type: 'module', version: '1.0.0' }, null, 4)}\n`,
        );
        writeFileSync(
            join(project, 'tsconfig.json'),
            '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
        );
        if (baseline !== null) {
            writeFileSync(join(project, 'jterrazz.baseline.json'), baseline);
        }

        return project;
    }

    test.each([
        { baseline: null, name: 'a failing pass with no baseline to judge it' },
        {
            baseline: '{\n    "typescript": { "eslint/no-debugger": 1 }\n}\n',
            name: 'a pass the baseline holds',
        },
    ])(
        'lints the project once, for the report every reader of the pass reads — $name',
        ({ baseline }) => {
            // Given - a project whose oxlint config loads a plugin that counts the linter runs
            const project = countedProject(baseline);

            // When - the quality checks run there
            spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

            // Then - one oxlint process linted the project; the other loads of the config only printed it
            const runs = readFileSync(join(project, 'runs.log'), 'utf8').split('\n');
            expect(runs.filter((run) => run.includes('--type-aware'))).toStrictEqual([
                expect.stringContaining('--type-aware --deny-warnings --format json'),
            ]);
        },
    );
});
