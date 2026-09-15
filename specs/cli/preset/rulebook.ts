import { execFileSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

/*
 * What the rulebook suites stand on. Not a `@jterrazz/test` specification: the
 * product under test is the PRESET, and `typescript check` cannot reach it —
 * check loads a preset from the consumer's node_modules, which a copied fixture
 * does not have. So these suites drive the oxlint binary directly, the same B9w
 * exception `oxlint.specification.ts` states.
 *
 * Two things about a sandbox are load-bearing, and both were learned the hard
 * way against oxlint 1.83:
 *
 *   - `oxlint --type-aware` finds tsgolint by walking UP from the working
 *     directory for `node_modules/.bin/tsgolint`. Without it every type-aware
 *     rule silently does not run and the suite is green about nothing.
 *   - `ignorePatterns` cannot match a path outside the config file's directory,
 *     and a symlink resolves to its target. A sandbox that symlinks the whole
 *     `node_modules` and then runs `oxlint --fix .` REWRITES the real
 *     dependency tree. So the sandbox links the two entries it needs and every
 *     run names its files; nothing here ever lints a directory.
 */

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const OXLINT = resolve(REPOSITORY, 'node_modules/.bin/oxlint');
const OXFMT = resolve(REPOSITORY, 'node_modules/.bin/oxfmt');

/** Every profile this package ships, and the tsconfig preset each one is linted under. */
export const PROFILES = Object.freeze([
    { name: 'node', tsconfig: 'node' },
    { name: 'library', tsconfig: 'library' },
    { name: 'next', tsconfig: 'next' },
    { name: 'astro', tsconfig: 'node' },
    { name: 'expo', tsconfig: 'expo' },
    { name: 'bun', tsconfig: 'node' },
    { name: 'react', tsconfig: 'react' },
] as const);

/** The profile config file a consumer's own config re-exports. */
export function profilePath(name: string): string {
    return resolve(REPOSITORY, 'presets/oxlint/profiles', `${name}.js`);
}

/** The formatting preset oxfmt is pointed at. */
export const OXFMT_CONFIG = resolve(REPOSITORY, 'presets/oxfmt/index.js');

/** A disposable copy of a fixture, wired the way a consumer wires a profile. */
export function sandbox(
    fixture: string,
    profile: string,
    tsconfigPreset: string,
    also: string[] = [],
): Disposable & { config: string; files: string[]; path: string } {
    const path = mkdtempSync(resolve(tmpdir(), 'jterrazz-rulebook-'));

    cpSync(fixture, path, { recursive: true });
    mkdirSync(resolve(path, 'node_modules/.bin'), { recursive: true });
    symlinkSync(
        resolve(REPOSITORY, 'node_modules/.bin/tsgolint'),
        resolve(path, 'node_modules/.bin/tsgolint'),
    );
    symlinkSync(
        resolve(REPOSITORY, 'node_modules/@types'),
        resolve(path, 'node_modules/@types'),
        'dir',
    );

    writeFileSync(
        resolve(path, 'tsconfig.json'),
        `${JSON.stringify(
            { extends: resolve(REPOSITORY, 'presets/tsconfig', `${tsconfigPreset}.json`) },
            null,
            4,
        )}\n`,
    );

    const config = resolve(path, 'oxlint.config.js');
    const entry = resolve(REPOSITORY, 'src/oxlint.js');
    writeFileSync(
        config,
        `import { compose, ${[profile, ...also].join(', ')} } from '${entry}';\n\n` +
            `export default compose(${[profile, ...also].join(', ')});\n`,
    );

    const files = readdirSync(fixture).toSorted();

    return {
        config,
        [Symbol.dispose]() {
            rmSync(path, { force: true, recursive: true });
        },
        files,
        path,
    };
}

/** Run oxlint in a sandbox and hand back its report. Never throws on a lint failure. */
export function oxlint(cwd: string, args: string[]): { status: number; stdout: string } {
    return run(OXLINT, args, cwd);
}

/** Run oxfmt in a sandbox. */
export function oxfmt(cwd: string, args: string[]): { status: number; stdout: string } {
    return run(OXFMT, ['--config', OXFMT_CONFIG, ...args], cwd);
}

/** What `--print-config` says about a profile, in the shape the suites read. */
export type ResolvedConfig = {
    plugins: string[];
    rules: Record<string, unknown>;
};

/**
 * One diagnostic of `oxlint --format=json`, in the fields the suites read.
 * `code` is the rule id in oxlint's own vocabulary — `eslint(max-params)`.
 */
export type Diagnostic = {
    code: string;
    filename: string;
    severity: string;
};

/** One row of `oxlint --rules --format=json`. */
export type RosterEntry = {
    category: string;
    scope: string;
    type_aware: boolean;
    value: string;
};

/*
 * The two trust boundaries of this harness. A tool's `--format=json` output is
 * the tool's contract; no runtime guard can re-derive it, so the assertion is
 * stated where it is made, with its reason, and every suite above reads a typed
 * value. `reportUnusedDisableDirectives` keeps each directive honest.
 */

/** The resolved rule set of a profile, as oxlint itself reports it. */
export function printConfig(name: string): ResolvedConfig {
    const { stdout } = run(OXLINT, ['-c', profilePath(name), '--print-config'], REPOSITORY);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own --print-config output is oxlint's contract
    return JSON.parse(stdout) as ResolvedConfig;
}

/**
 * The diagnostics of one `--format=json` run, as oxlint itself reports them.
 * Every suite reads this rather than the human report, because the human one
 * has no fixed shape: oxlint picks its reporter from the environment — GitHub
 * workflow commands under `GITHUB_ACTIONS`, one compact line per diagnostic
 * under an AI agent, miette's framed rendering otherwise. `--format=json` is
 * the one form that is the same on a laptop and on a runner.
 */
export function diagnosticsOf(report: { stdout: string }): Diagnostic[] {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own --format=json output is oxlint's contract
    return (JSON.parse(report.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
}

/** Every rule oxlint knows at this pinned version, nursery included. */
export function roster(): RosterEntry[] {
    const { stdout } = run(OXLINT, ['--rules', '--format=json'], REPOSITORY);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own --rules output is oxlint's contract
    return JSON.parse(stdout) as RosterEntry[];
}

function run(binary: string, args: string[], cwd: string): { status: number; stdout: string } {
    try {
        return { status: 0, stdout: execFileSync(binary, args, { cwd, encoding: 'utf8' }) };
    } catch (error) {
        return parseFailure(error);
    }
}

/** What `execFileSync` throws: the child's exit code and whatever it printed. */
function parseFailure(error: unknown): { status: number; stdout: string } {
    if (typeof error !== 'object' || error === null) {
        return { status: 1, stdout: '' };
    }
    const status = 'status' in error && typeof error.status === 'number' ? error.status : 1;
    const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
    return { status, stdout };
}
