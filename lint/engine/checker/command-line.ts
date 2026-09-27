const VALUED_BY_EVERY_PASS = ['--format', '--ignore-pattern', '--report'];

export type CommandLine = {
    has: (flag: string) => boolean;
    positionals: string[];
    value: {
        (flag: string): string | undefined;
        (flag: string, fallback: string): string;
    };
    values: (flag: string) => string[];
};

export function readCommandLine(
    args: readonly string[],
    valued: readonly string[] = [],
): CommandLine {
    const takesValue = new Set([...VALUED_BY_EVERY_PASS, ...valued]);
    const flags = new Map<string, string[]>();
    const positionals: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index] ?? '';
        if (!argument.startsWith('-')) {
            positionals.push(argument);
            continue;
        }
        const values = flags.get(argument) ?? [];
        flags.set(argument, values);
        if (takesValue.has(argument)) {
            const value = args[index + 1];
            if (value !== undefined) {
                values.push(value);
            }
            index += 1;
        }
    }

    return {
        has: (flag) => flags.has(flag),
        positionals,
        value: ((flag: string, fallback?: string) =>
            flags.get(flag)?.[0] ?? fallback) as CommandLine['value'],
        values: (flag) => flags.get(flag) ?? [],
    };
}
