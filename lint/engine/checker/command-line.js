const VALUED_BY_EVERY_PASS = ['--format', '--ignore-pattern', '--report'];

export function readCommandLine(args, valued = []) {
    const takesValue = new Set([...VALUED_BY_EVERY_PASS, ...valued]);
    const flags = new Map();
    const positionals = [];

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (!argument.startsWith('-')) {
            positionals.push(argument);
            continue;
        }
        const values = flags.get(argument) ?? [];
        flags.set(argument, values);
        if (takesValue.has(argument)) {
            if (args[index + 1] !== undefined) {
                values.push(args[index + 1]);
            }
            index += 1;
        }
    }

    return {
        has: (flag) => flags.has(flag),
        positionals,
        value: (flag, fallback) => flags.get(flag)?.[0] ?? fallback,
        values: (flag) => flags.get(flag) ?? [],
    };
}
