import process from 'node:process';

function set(entries: readonly (readonly [string, string | undefined])[]): void {
    for (const [name, value] of entries) {
        if (value === undefined) {
            Reflect.deleteProperty(process.env, name);
        } else {
            process.env[name] = value;
        }
    }
}

/** Runs `run` with each variable of `values` set in this process's environment, one `undefined` taken away, and gives each back as it found it, a failure included. */
export async function withEnvironment<T>(
    values: Readonly<Record<string, string | undefined>>,
    run: () => Promise<T>,
): Promise<T> {
    const before = Object.keys(values).map((name) => [name, process.env[name]] as const);
    set(Object.entries(values));
    try {
        return await run();
    } finally {
        set(before);
    }
}
