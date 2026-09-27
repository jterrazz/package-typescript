import { join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../lint/engine/catalogue/lesson.js';
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

function usage(name: string): number {
    const unknown =
        name === ''
            ? ''
            : `${refusal({
                  fix: 'run one of the commands below',
                  found: `no command named ${name}`,
                  read: 'docs/02-developing.md#3-wire-the-cli-into-packagejson',
                  why: 'the toolchain answers only the commands it declares',
              })}\n\n`;
    print(`${badge('TYPESCRIPT')} TypeScript toolchain\n\n${unknown}${USAGE.join('\n')}\n`);

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
    'docs-layout': async ([root]) =>
        await handOver(process.execPath, [
            CHECKER,
            'docs',
            root === undefined || root === '' ? projectRoot() : root,
        ]),
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
    const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;

    return command === undefined ? usage(name) : await command(rest, selected);
}
