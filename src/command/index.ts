import { join } from 'node:path';
import process from 'node:process';

import { baseline } from './baseline.js';
import { build, bundle, clean, dev, start } from './build.js';
import { EVERY_PASS, runChecks } from './check/index.js';
import type { Selected } from './check/index.js';
import { doctor } from './doctor.js';
import { handOver } from './processes.js';
import { badge, print } from './terminal.js';
import { CHECKER, projectRoot, tscIn } from './toolchain.js';

export { CHECK_PASSES } from './check/index.js';
export type { CheckPass, Selected } from './check/index.js';

const USAGE = [
    'Usage: typescript <command>',
    '',
    'Commands:',
    '  build        Build application (ESM + types)',
    '  bundle       Bundle library (ESM + CJS + types)',
    '  start        Run the built application',
    '  dev          Build, run, and rebuild on changes',
    "  docs-layout  Check a repository's docs/ against the manual spine",
    '  doctor       Report the installed tool versions against the declared ranges',
    "  baseline     Record oxlint's own rules, Names and Comments into jterrazz.baseline.json",
    '  tsc          Run the TypeScript 7 compiler this package ships (emit, --build)',
    '  check        Check types, lint, formatting, and unused code',
    '  fix          Auto-fix lint and formatting issues',
    "  clean        Remove .artifacts/ — dist/ stays, it is the build's product",
    '',
    'Examples:',
    ...[
        'build',
        'bundle',
        'start',
        'dev',
        'docs-layout .',
        'doctor',
        'baseline',
        'tsc --build',
        'check',
        'fix',
        'clean',
    ].map((example) => `  typescript ${example}`),
];

function usage(): number {
    print(`${badge('TYPESCRIPT')} TypeScript toolchain\n\n${USAGE.join('\n')}\n`);

    return 1;
}

type Command = (args: readonly string[], selected: Selected) => number | Promise<number>;

const COMMANDS: Readonly<Record<string, Command>> = {
    baseline: async (args) => await baseline(args),
    build: async () => await build(),
    bundle: async () => await bundle(),
    check: async (args, selected) => await runChecks(args, { fix: false, selected }),
    clean: () => clean(),
    dev: async () => await dev(),
    // For a repository with no npm project to hang `check` on (a Go, Rust or Ansible tree, through npx).
    'docs-layout': async (args) =>
        await handOver(process.execPath, [CHECKER, 'docs', args[0] ?? projectRoot()]),
    doctor: () => {
        print(`${badge('TYPESCRIPT')} Checking the toolchain...\n\n`);

        return doctor(projectRoot());
    },
    fix: async (args, selected) => await runChecks(args, { fix: true, selected }),
    start: async (args) => await start(args),
    tsc: async (args) => {
        const project = projectRoot();

        return await handOver(tscIn(join(project, 'node_modules/.bin')), args, project);
    },
};

export async function main(
    args: readonly string[],
    { selected = EVERY_PASS }: { selected?: Selected } = {},
): Promise<number> {
    const [name = '', ...rest] = args;
    const command = COMMANDS[name];

    return command === undefined ? usage() : await command(rest, selected);
}
