const VALUED_BY_EVERY_PASS = ['--format'];

export type CommandLine = {
    has: (flag: string) => boolean;
    positionals: string[];
    value: {
        (flag: string): string | undefined;
        (flag: string, fallback: string): string;
    };
    values: (flag: string) => string[];
};

function readInline(
    argument: string,
    { flags, takesValue }: { flags: Map<string, string[]>; takesValue: ReadonlySet<string> },
): boolean {
    const inline = /^(?<flag>--[^=]+)=(?<value>.*)$/u.exec(argument)?.groups;
    if (inline?.flag === undefined || !takesValue.has(inline.flag)) {
        return false;
    }
    flags.set(inline.flag, [...(flags.get(inline.flag) ?? []), inline.value ?? '']);

    return true;
}

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
        if (readInline(argument, { flags, takesValue })) {
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

    function value(flag: string): string | undefined;
    function value(flag: string, fallback: string): string;
    function value(flag: string, fallback?: string): string | undefined {
        return flags.get(flag)?.[0] ?? fallback;
    }

    return {
        has: (flag) => flags.has(flag),
        positionals,
        value,
        values: (flag) => flags.get(flag) ?? [],
    };
}
