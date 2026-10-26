import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { FORWARD_ALL } from './surface.js';
import type { Flag, Surface } from './surface.js';

export type Reading =
    | { args: string[]; kind: 'run' }
    | { kind: 'help' }
    | { kind: 'refused'; lesson: string };

const HELP: ReadonlySet<string> = new Set(['--help', '-h']);

function written(flag: Flag): string {
    return flag.value === undefined ? flag.name : `${flag.name} ${flag.value}`;
}

function readsList(name: string, surface: Surface): string {
    const flags = surface.flags ?? [];

    return flags.length === 0
        ? `\`typescript ${name}\` reads no flag`
        : `it reads ${flags.map(written).join(', ')}`;
}

// invariant: the flag every gate once took to leave a path out for one run is refused with the declaration that replaced it, since a bare "no such flag" would send its author to look for another spelling of the same exception.
const RETIRED_IGNORE =
    'a path left out of one run is read differently by each gate: the formatter, the Markdown pass and the linter disagreed on what it covered, and 85 goldens were rewritten in one repository';

function unknownFlag(name: string, flag: string, surface: Surface): string {
    if (flag === '--ignore-pattern') {
        return refusal({
            fix: 'declare the folder in studio.config.ts, where every gate reads it alike: `typescript: { roots: { "<folder>": { reason: "<why it is kept as written>", verbatim: true } } }`',
            found: `\`typescript ${name}\` has no flag --ignore-pattern, which is retired`,
            read: 'docs/reference/quality-checks.md#a-root-beside-the-spine',
            why: RETIRED_IGNORE,
        });
    }

    return refusal({
        fix: `drop it: ${readsList(name, surface)}`,
        found: `\`typescript ${name}\` has no flag ${flag}`,
        read: 'docs/reference/commands.md#flags-and-help',
        why: 'a flag the command does not read would be ignored, and the run would not be the one asked for',
    });
}

function repeatedFlag(flag: Flag): string {
    return refusal({
        fix:
            flag.value === '<ranges>'
                ? `give it once, every range in one comma-separated value: ${flag.name} src/a.ts:10-20,src/b.ts:1-5`
                : `give it once: ${written(flag)}`,
        found: `${flag.name} is given more than once`,
        read: 'docs/reference/commands.md#flags-and-help',
        why:
            flag.value === undefined
                ? 'the command reads it once, and a line that says it twice was written for another run than this one'
                : 'the command reads it once, and a second value would silently replace the first',
    });
}

function valueless(flag: Flag): string {
    return refusal({
        fix: `write it ${written(flag)}`,
        found: `${flag.name} has no value`,
        read: 'docs/reference/commands.md#flags-and-help',
        why: 'a flag read without its value would run the command on another value than the one meant',
    });
}

function valueGiven(flag: Flag): string {
    return refusal({
        fix: `write it ${flag.name}, alone`,
        found: `${flag.name} takes no value`,
        read: 'docs/reference/commands.md#flags-and-help',
        why: 'a value the command does not read would be ignored, and the run would not be the one asked for',
    });
}

function extraOperand(name: string, operand: string, surface: Surface): string {
    return refusal({
        fix:
            surface.operand === undefined
                ? `drop it: \`typescript ${name}\` takes no argument`
                : `name one ${surface.operand}, or none`,
        found: `\`typescript ${name}\` was given ${operand}, ${surface.operand === undefined ? 'an argument it does not read' : `a second ${surface.operand}`}`,
        read: 'docs/reference/commands.md#flags-and-help',
        why: 'an argument the command does not read would be ignored, and the run would not be the one asked for',
    });
}

type Parsed = { flags: string[]; operands: string[] };

function inlineOf(argument: string): [string, string | undefined] {
    const equals = argument.indexOf('=');

    return argument.startsWith('--') && equals !== -1
        ? [argument.slice(0, equals), argument.slice(equals + 1)]
        : [argument, undefined];
}

type Parsing = Parsed & { seen: Set<string> };

function flagRead(
    flag: Flag,
    { inline, next }: { inline: string | undefined; next: string | undefined },
    parsing: Parsing,
): string | undefined {
    if (parsing.seen.has(flag.name)) {
        return repeatedFlag(flag);
    }
    parsing.seen.add(flag.name);
    if (flag.value === undefined) {
        if (inline !== undefined) {
            return valueGiven(flag);
        }
        parsing.flags.push(flag.name);

        return undefined;
    }
    const value = inline ?? next;
    if (value === undefined || value === '' || value.startsWith('--')) {
        return valueless(flag);
    }
    parsing.flags.push(flag.name, value);

    return undefined;
}

function parsed(name: string, surface: Surface, args: readonly string[]): Parsed | string {
    const parsing: Parsing = { flags: [], operands: [], seen: new Set() };
    let valueTaken = false;
    for (const [index, argument] of args.entries()) {
        if (valueTaken) {
            valueTaken = false;
            continue;
        }
        if (!argument.startsWith('-')) {
            parsing.operands.push(argument);
            continue;
        }
        const [spelled, inline] = inlineOf(argument);
        const flag = surface.flags?.find(({ name: known }) => known === spelled);
        if (flag === undefined) {
            return unknownFlag(name, spelled, surface);
        }
        const refused = flagRead(flag, { inline, next: args[index + 1] }, parsing);
        if (refused !== undefined) {
            return refused;
        }
        valueTaken = flag.value !== undefined && inline === undefined;
    }

    return parsing;
}

/** Reads a command's line against its surface: a help request, a refusal in four parts, or the arguments it runs on, each flag spelled apart from its value. */
export function readArguments(name: string, surface: Surface, args: readonly string[]): Reading {
    if (surface.forwards === 'everything') {
        return { args: [...args], kind: 'run' };
    }
    const end = args.indexOf(FORWARD_ALL);
    const own = end === -1 ? args : args.slice(0, end);
    if (own.some((argument) => HELP.has(argument))) {
        return { kind: 'help' };
    }
    if (surface.forwards === 'after-help') {
        return { args: end === -1 ? [...args] : [...own, ...args.slice(end + 1)], kind: 'run' };
    }
    const read = parsed(name, surface, args);
    if (typeof read === 'string') {
        return { kind: 'refused', lesson: read };
    }
    const excess = read.operands[surface.operand === undefined ? 0 : 1];
    if (excess !== undefined) {
        return { kind: 'refused', lesson: extraOperand(name, excess, surface) };
    }

    return { args: [...read.operands, ...read.flags], kind: 'run' };
}
