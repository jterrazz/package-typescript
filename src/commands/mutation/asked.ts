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
        // invariant: CI runs cold, since its verdict stands on no report a runner kept from an earlier tree, and a local run inherits what the change since its report leaves standing.
        cold:
            commandLine.has('--cold') ||
            blankAsUnset(process.env.TYPESCRIPT_MUTATION_COLD) !== undefined ||
            blankAsUnset(process.env.CI) !== undefined,
        named: commandLine.value('--since') ?? blankAsUnset(process.env.TYPESCRIPT_MUTATION_SINCE),
        ranges: commandLine.value('--mutate')?.split(','),
    };
}
