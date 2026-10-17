import process from 'node:process';

import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { readArguments } from './arguments.js';
import { baseline } from './baseline/baseline.command.js';
import { build } from './build/build.command.js';
import { check } from './check/check.command.js';
import { EVERY_PASS } from './check/passes/passes.js';
import type { Selected } from './check/passes/passes.js';
import { badge, print } from './check/report/terminal.js';
import { clean } from './clean/clean.command.js';
import { dev } from './dev/dev.command.js';
import { docsLayout } from './docs-layout/docs-layout.command.js';
import { doctor } from './doctor/doctor.command.js';
import { fix } from './fix/fix.command.js';
import { gateLock } from './gate-lock/gate-lock.command.js';
import { mutation } from './mutation/mutation.command.js';
import { start } from './start/start.command.js';
import { helpOf, SURFACES } from './surface.js';
import type { CommandName, Surface } from './surface.js';
import { tsc } from './tsc/tsc.command.js';

export { CHECK_PASSES } from './check/passes/passes.js';
export type { CheckPass, Selected } from './check/passes/passes.js';

const LISTED = Object.entries(SURFACES).map(([name, surface]: [string, Surface]) => ({
    example: surface.example === undefined ? name : `${name} ${surface.example}`,
    name,
    says: surface.says,
}));

const USAGE = [
    'Usage: typescript <command> [flags]',
    '',
    'Commands:',
    ...LISTED.map(({ name, says }) => `  ${name.padEnd(13)}${says}`),
    '',
    'Examples:',
    ...LISTED.map(({ example }) => `  typescript ${example}`),
    '',
    "A command's flags: typescript <command> --help",
];

const BANNER = `${badge('TYPESCRIPT')} TypeScript toolchain\n\n`;

const HELP: ReadonlySet<string> = new Set(['--help', '-h']);

function usage(name: string): number {
    if (HELP.has(name)) {
        print(`${BANNER}${USAGE.join('\n')}\n`);

        return 0;
    }
    const unknown =
        name === ''
            ? ''
            : `${refusal({
                  fix: 'run one of the commands below',
                  found: `no command named ${name}`,
                  read: 'docs/start/getting-started.md#3-wire-the-cli-into-packagejson',
                  why: 'the toolchain answers only the commands it declares',
              })}\n\n`;
    print(`${BANNER}${unknown}${USAGE.join('\n')}\n`);

    return 1;
}

const isCommand = (name: string): name is CommandName => Object.hasOwn(SURFACES, name);

type Command = (args: readonly string[], selected: Selected) => number | Promise<number>;

const COMMANDS: Readonly<Record<CommandName, Command>> = {
    baseline,
    build,
    check,
    clean,
    dev,
    'docs-layout': docsLayout,
    doctor: async () => await doctor(process.cwd()),
    fix,
    'gate-lock': gateLock,
    mutation,
    start,
    tsc,
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
    if (!isCommand(name)) {
        return usage(name);
    }
    const surface: Surface = SURFACES[name];
    const reading = readArguments(name, surface, rest);
    if (reading.kind === 'help') {
        print(`${BANNER}${helpOf(name, surface)}\n`);

        return 0;
    }
    if (reading.kind === 'refused') {
        print(`${BANNER}${reading.lesson}\n\n${helpOf(name, surface)}\n`);

        return 1;
    }
    writeNoJitiCache();

    return await COMMANDS[name](reading.args, selected);
}
