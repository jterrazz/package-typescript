import { spawn } from 'node:child_process';
import type { ChildProcess, StdioOptions } from 'node:child_process';
import { closeSync, openSync, writeSync } from 'node:fs';
import { constants } from 'node:os';
import process from 'node:process';
import { promisify } from 'node:util';

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

const drained = promisify(
    (stream: NodeJS.WriteStream, done: (error?: Error | null) => void): void => {
        stream.write('', done);
    },
);

async function flushed(): Promise<void> {
    await Promise.all([drained(process.stdout), drained(process.stderr)]);
}

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
    return await new Promise((resolve) => {
        child.once('error', () => {
            notFound(command, err);
            resolve(NOT_FOUND);
        });
        child.once('close', (code: null | number, signal: NodeJS.Signals | null) => {
            // Stryker disable next-line ConditionalExpression: Node sets the signal whenever it leaves the code null
            resolve(code ?? SIGNALLED + (signal === null ? 0 : constants.signals[signal]));
        });
    });
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
        if (out === 'inherit' || err === 'inherit') {
            await flushed();
        }

        return await exited(spawn(command, args, { cwd: options.cwd, stdio }), command, err);
    } finally {
        for (const descriptor of opened) {
            closeSync(descriptor);
        }
    }
}

function signalled(group: number, signal: NodeJS.Signals): void {
    try {
        process.kill(-group, signal);
    } catch {
        // invariant: a group with no member left is no error, nothing remains to signal.
    }
}

/** Hands the terminal over to a command. With `reaping`, the command leads a process group of its own: signals reach the whole group, and when the command ends every process still in it is killed, so none outlives it as an orphan. */
export async function handOver(
    command: string,
    args: readonly string[],
    cwd?: string,
    { reaping = false }: { reaping?: boolean } = {},
): Promise<number> {
    await flushed();
    const child = spawn(command, args, { cwd, detached: reaping, stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals): void => {
        if (reaping && child.pid !== undefined) {
            signalled(child.pid, signal);
        } else {
            child.kill(signal);
        }
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
        if (reaping && child.pid !== undefined) {
            signalled(child.pid, 'SIGKILL');
        }
    }
}
