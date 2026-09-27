import { spawn } from 'node:child_process';
import type { ChildProcess, StdioOptions } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, openSync, writeSync } from 'node:fs';
import { constants } from 'node:os';
import process from 'node:process';

export type Stream = 'ignore' | 'inherit' | { append?: boolean; path: string };

export type Spawned = {
    cwd?: string;
    stderr?: 'stdout' | Stream;
    stdout?: Stream;
};

type Descriptor = 'ignore' | 'inherit' | number;

const NOT_FOUND = 127;

const SIGNALLED = 128;

const FORWARDED: readonly NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];

function descriptorOf(stream: Stream, opened: number[]): Descriptor {
    if (typeof stream === 'string') {
        return stream;
    }
    const descriptor = openSync(stream.path, stream.append === true ? 'a' : 'w');
    opened.push(descriptor);

    return descriptor;
}

function notFound(command: string, err: Descriptor): void {
    const line = `${command}: command not found\n`;
    if (typeof err === 'number') {
        writeSync(err, line);
    } else if (err === 'inherit') {
        process.stderr.write(line);
    }
}

async function exited(child: ChildProcess, command: string, err: Descriptor): Promise<number> {
    try {
        const closed: unknown[] = await once(child, 'close');
        const [code, signal] = closed;
        if (typeof code === 'number') {
            return code;
        }

        return (
            SIGNALLED +
            (typeof signal === 'string'
                ? ((constants.signals as Record<string, number>)[signal] ?? 0)
                : 0)
        );
    } catch {
        notFound(command, err);

        return NOT_FOUND;
    }
}

export async function run(
    command: string,
    args: readonly string[],
    options: Spawned = {},
): Promise<number> {
    const opened: number[] = [];
    const out = descriptorOf(options.stdout ?? 'inherit', opened);
    const err =
        options.stderr === 'stdout' ? out : descriptorOf(options.stderr ?? 'inherit', opened);
    const stdio: StdioOptions = ['ignore', out, err];

    try {
        return await exited(spawn(command, args, { cwd: options.cwd, stdio }), command, err);
    } finally {
        for (const descriptor of opened) {
            closeSync(descriptor);
        }
    }
}

export async function handOver(
    command: string,
    args: readonly string[],
    cwd?: string,
): Promise<number> {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals): void => {
        child.kill(signal);
    };
    for (const signal of FORWARDED) {
        process.on(signal, forward);
    }

    try {
        return await exited(child, command, 'inherit');
    } finally {
        for (const signal of FORWARDED) {
            process.off(signal, forward);
        }
    }
}
