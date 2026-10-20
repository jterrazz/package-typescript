import process from 'node:process';

import { readCommandLine } from '../../../lint/kit/checker/command-line.js';

export const blankAsUnset = (value: string | undefined): string | undefined =>
    value === undefined || value.trim() === '' ? undefined : value;

export type Asked = {
    cold: boolean;
    named: string | undefined;
    ranges: readonly string[] | undefined;
};

export function askedOf(args: readonly string[]): Asked {
    const commandLine = readCommandLine(args, ['--mutate', '--since']);

    return {
        // invariant: a run inherits what the change since its report leaves standing, on every host alike, since the report is kept by the bytes of every file it stood on; a host that restores no report runs cold by that alone, and only the flag asks it.
        cold: commandLine.has('--cold'),
        named: commandLine.value('--since') ?? blankAsUnset(process.env.TYPESCRIPT_MUTATION_SINCE),
        ranges: commandLine.value('--mutate')?.split(','),
    };
}
