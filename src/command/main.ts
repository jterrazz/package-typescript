import { join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { baseline } from './baseline.js';
import { build, clean, dev, start } from './build.js';
import { EVERY_PASS, runChecks } from './check/check.js';
import type { Selected } from './check/check.js';
import { doctor } from './doctor.js';
import { mutation } from './mutation.js';
import { handOver } from './processes.js';
import { badge, print } from './terminal.js';
import { checkerProgram, tscIn } from './toolchain.js';

export { CHECK_PASSES } from './check/check.js';
export type { CheckPass, Selected } from './check/check.js';

const USAGE = [
    'Usage: typescript <command>',
    '',
    'Commands:',
    '  build        Build the entries the manifest publishes, as its conditions ask',
    '  start        Run the built application',
    '  dev          Build, run, and rebuild on changes',
    "  docs-layout  Check a repository's docs/ against the manual's shape",
    '  doctor       Report the installed tool versions against the declared ranges',
    '  mutation     Measure the suite against mutants of the sources (--mutate <ranges> narrows it)',
    "  baseline     Record the debt: oxlint's in .jterrazz/oxlint-suppressions.json, the rest in .jterrazz/baseline.json",
    '  tsc          Run the TypeScript 7 compiler this package ships (emit, --build)',
    '  check        Check types, lint, formatting, and unused code',
    '  fix          Auto-fix lint and formatting issues',
    "  clean        Remove .artifacts/ — dist/ stays, it is the build's product",
    '',
    'Examples:',
    ...[
        'build',
        'start',
        'dev',
        'docs-layout .',
        'doctor',
        'mutation',
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
                  read: 'docs/start/getting-started.md#3-wire-the-cli-into-packagejson',
                  why: 'the toolchain answers only the commands it declares',
              })}\n\n`;
    print(`${badge('TYPESCRIPT')} TypeScript toolchain\n\n${unknown}${USAGE.join('\n')}\n`);

    return 1;
}

type Command = (args: readonly string[], selected: Selected) => number | Promise<number>;

const COMMANDS: Readonly<Record<string, Command>> = {
    baseline: async (args) => await baseline(args),
    build: async () => await build(),
    check: async (args, selected) => await runChecks(args, { fix: false, selected }),
    clean: () => clean(),
    dev: async () => await dev(),
    'docs-layout': async ([root]) =>
        await handOver(process.execPath, [
            checkerProgram(),
            'docs',
            root === undefined || root === '' ? process.cwd() : root,
        ]),
    doctor: () => {
        print(`${badge('TYPESCRIPT')} Checking the toolchain...\n\n`);

        return doctor(process.cwd());
    },
    fix: async (args, selected) => await runChecks(args, { fix: true, selected }),
    mutation: async (args) => await mutation(args),
    start: async (args) => await start(args),
    tsc: async (args) => {
        const project = process.cwd();

        return await handOver(tscIn(join(project, 'node_modules/.bin')), args, project);
    },
};

// outside: jiti reads its cache place from options only; the variable merely turns the cache off.
function writeNoJitiCache(): void {
    process.env.JITI_FS_CACHE = 'false';
}

export async function main(
    args: readonly string[],
    { selected = EVERY_PASS }: { selected?: Selected } = {},
): Promise<number> {
    const [name = '', ...rest] = args;
    const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;

    if (command === undefined) {
        return usage(name);
    }
    writeNoJitiCache();

    return await command(rest, selected);
}
