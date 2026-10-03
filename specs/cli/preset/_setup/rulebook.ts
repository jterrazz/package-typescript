import { execFileSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import { newDirectory } from '../../_setup/temporary-directory.js';

// oxlint 1.83 hazards: `--type-aware` walks up for `node_modules/.bin/tsgolint`, or every type-aware rule
// silently skips; and a symlinked `node_modules` under `oxlint --fix .` rewrites the real dependency tree —
// so the sandbox links two entries and every run names its files.

const REPOSITORY = resolve(import.meta.dirname, '../../../..');
const OXLINT = resolve(REPOSITORY, 'node_modules/.bin/oxlint');
const OXFMT = resolve(REPOSITORY, 'node_modules/.bin/oxfmt');

export const PROFILES = Object.freeze([
    { name: 'node', tsconfig: 'node' },
    { name: 'next', tsconfig: 'next' },
    { name: 'astro', tsconfig: 'astro' },
    { name: 'expo', tsconfig: 'expo' },
    { name: 'bun', tsconfig: 'node' },
    { name: 'react', tsconfig: 'react' },
] as const);

// The profiles ship as values of the `#rulebook` entry; oxlint reads a config by path, so each is laid as a module.
const PROFILE_MODULES = newDirectory('jterrazz-profiles-');

export const DERIVED_CONFIG = `import { oxlintConfigAt } from ${JSON.stringify(resolve(REPOSITORY, 'dist/rulebook.js'))};\n\nexport default await oxlintConfigAt(import.meta.dirname);\n`;

export function profilePath(name: string): string {
    const path = resolve(PROFILE_MODULES, `${name}.mjs`);
    writeFileSync(
        path,
        `import { PROFILE_CONFIGS } from ${JSON.stringify(resolve(REPOSITORY, 'dist/rulebook.js'))};\n\nexport default PROFILE_CONFIGS.${name};\n`,
    );

    return path;
}

export const OXFMT_CONFIG = resolve(PROFILE_MODULES, 'oxfmt.config.mjs');
writeFileSync(
    OXFMT_CONFIG,
    `import { oxfmtConfig } from ${JSON.stringify(resolve(REPOSITORY, 'dist/oxfmt.js'))};\n\nexport default await oxfmtConfig(import.meta);\n`,
);

// A real directory, never a link: tsc resolves a preset's own `extends` from its real path.
export function installTsconfigPresets(project: string): void {
    const installed = resolve(project, 'node_modules/@jterrazz/typescript');
    mkdirSync(installed, { recursive: true });
    cpSync(resolve(REPOSITORY, 'package.json'), resolve(installed, 'package.json'));
    cpSync(
        resolve(REPOSITORY, 'src/presets/tsconfig'),
        resolve(installed, 'src/presets/tsconfig'),
        {
            recursive: true,
        },
    );
    cpSync(
        resolve(import.meta.dirname, '../_fixtures/astro-package'),
        resolve(project, 'node_modules/astro'),
        {
            recursive: true,
        },
    );
}

export function sandbox(
    fixture: string,
    profile: string,
    tsconfigPreset: string,
): Disposable & { config: string; files: string[]; path: string } {
    const path = newDirectory('jterrazz-rulebook-');

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
    // An unresolved `vitest` import makes every call an `any`, which the type-aware rules would report.
    symlinkSync(
        resolve(REPOSITORY, 'node_modules/vitest'),
        resolve(path, 'node_modules/vitest'),
        'dir',
    );

    installTsconfigPresets(path);
    writeFileSync(
        resolve(path, 'tsconfig.json'),
        `${JSON.stringify({ extends: `@jterrazz/typescript/tsconfig/${tsconfigPreset}` }, null, 4)}\n`,
    );

    const config = resolve(path, 'oxlint.config.mjs');
    writeFileSync(config, readFileSync(profilePath(profile), 'utf8'));

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

export function oxlint(cwd: string, args: string[]): { status: number; stdout: string } {
    return run(OXLINT, args, cwd);
}

export function oxfmt(cwd: string, args: string[]): { status: number; stdout: string } {
    return run(OXFMT, ['--config', OXFMT_CONFIG, ...args], cwd);
}

export type ResolvedConfig = {
    env?: Record<string, boolean>;
    globals?: Record<string, string>;
    options?: Record<string, unknown>;
    overrides?: { files: string[]; rules: Record<string, unknown> }[];
    plugins: string[];
    rules: Record<string, unknown>;
};

export type Diagnostic = {
    code: string;
    filename: string;
    labels: { span: { column: number; line: number } }[];
    message: string;
    severity: string;
};

export type RosterEntry = {
    category: string;
    fix: string;
    scope: string;
    type_aware: boolean;
    value: string;
};

export function printConfig(name: string): ResolvedConfig {
    const { stdout } = run(OXLINT, ['-c', profilePath(name), '--print-config'], REPOSITORY);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own --print-config output is oxlint's contract
    return JSON.parse(stdout) as ResolvedConfig;
}

// `--format=json` is the one form that is the same on a laptop and on a runner.
export function diagnosticsOf(report: { stdout: string }): Diagnostic[] {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own --format=json output is oxlint's contract
    return (JSON.parse(report.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
}

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

function parseFailure(error: unknown): { status: number; stdout: string } {
    if (typeof error !== 'object' || error === null) {
        return { status: 1, stdout: '' };
    }
    const status = 'status' in error && typeof error.status === 'number' ? error.status : 1;
    const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
    return { status, stdout };
}
