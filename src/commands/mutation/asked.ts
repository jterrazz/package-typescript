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
        cold:
            commandLine.has('--cold') ||
            blankAsUnset(process.env.TYPESCRIPT_MUTATION_COLD) !== undefined,
        named: commandLine.value('--since') ?? blankAsUnset(process.env.TYPESCRIPT_MUTATION_SINCE),
        ranges: commandLine.value('--mutate')?.split(','),
    };
}
