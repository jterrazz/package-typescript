import { spawnSync } from 'node:child_process';
import {
    existsSync,
    fstatSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { handOver, run } from './run.js';

const NODE_WRITES = String.raw`process.stdout.write('out\n'); process.stderr.write('err\n')`;

const LINE = 'no-such-tool-anywhere: command not found\n';

function spied(stream: NodeJS.WriteStream) {
    const write = vi.spyOn(stream, 'write');
    onTestFinished(() => {
        write.mockRestore();
    });

    return write;
}

function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), 'processes-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}

describe('run', () => {
    test('exits 127 for a command that is not there, and says so in its log', async () => {
        // Given - a log for a tool no PATH holds
        const log = join(scratch(), 'missing.log');

        // When - it is run
        const status = await run('no-such-tool-anywhere', ['--version'], {
            stderr: 'stdout',
            stdout: { path: log },
        });

        // Then - the status and the line are the shell's
        expect(status).toBe(127);
        expect(readFileSync(log, 'utf8')).toBe('no-such-tool-anywhere: command not found\n');
    });

    test('exits 128 plus the signal for a child a signal ended', async () => {
        // Given - a child that sends itself SIGTERM

        // When - it is run
        const status = await run(process.execPath, [
            '--eval',
            "process.kill(process.pid, 'SIGTERM')",
        ]);

        // Then - the status is the shell's for a killed child
        expect(status).toBe(143);
    });

    test('writes both streams into one log when stderr follows stdout', async () => {
        // Given - a child writing one line to each stream
        const log = join(scratch(), 'both.log');

        // When - its stderr follows its stdout into the log
        await run(
            process.execPath,
            ['--eval', String.raw`process.stdout.write('out\n'); process.stderr.write('err\n')`],
            { stderr: 'stdout', stdout: { path: log } },
        );

        // Then - the one file holds both
        expect(readFileSync(log, 'utf8')).toBe('out\nerr\n');
    });

    test('starts an inheriting child only after what the parent queued on the pipe', () => {
        // Given - a parent that queues more than a pipe holds, then runs a child on the same stdout
        const script = [
            `import { run } from ${JSON.stringify(join(import.meta.dirname, 'run.ts'))};`,
            String.raw`process.stdout.write('x'.repeat(1_000_000) + '\nparent\n');`,
            "await run('echo', ['child']);",
        ].join('\n');

        // When - it runs with its stdout on a pipe nobody reads for a moment
        const result = spawnSync(
            'sh',
            ['-c', '"$NODE" --input-type=module --eval "$SCRIPT" | { sleep 1; tail -c 14; }'],
            { encoding: 'utf8', env: { ...process.env, NODE: process.execPath, SCRIPT: script } },
        );

        // Then - the child's line comes last
        expect(result.stdout).toBe('\nparent\nchild\n');
    });

    test('exits with the code the child exits with', async () => {
        // Given - a child that exits 3
        // Then - 3 is the status
        await expect(run(process.execPath, ['--eval', 'process.exit(3)'])).resolves.toBe(3);
    });

    test('keeps stderr apart when it does not follow stdout', async () => {
        // Given - one log per stream
        const directory = scratch();

        // When - a child writes a line to each
        await run(process.execPath, ['--eval', NODE_WRITES], {
            stderr: { path: join(directory, 'err.log') },
            stdout: { path: join(directory, 'out.log') },
        });

        // Then - each log holds its own stream
        expect(readFileSync(join(directory, 'out.log'), 'utf8')).toBe('out\n');
        expect(readFileSync(join(directory, 'err.log'), 'utf8')).toBe('err\n');
    });

    test('appends to a log only when told to, and overwrites it otherwise', async () => {
        // Given - two logs that already hold a line
        const directory = scratch();
        const appended = join(directory, 'appended.log');
        const replaced = join(directory, 'replaced.log');
        writeFileSync(appended, 'before\n');
        writeFileSync(replaced, 'before\n');

        // When - the same child writes into each
        await run('echo', ['after'], { stdout: { append: true, path: appended } });
        await run('echo', ['after'], { stdout: { path: replaced } });

        // Then - one keeps its line, the other starts over
        expect(readFileSync(appended, 'utf8')).toBe('before\nafter\n');
        expect(readFileSync(replaced, 'utf8')).toBe('after\n');
    });

    test('closes every log it opens', async () => {
        // Given - the descriptors open before the run
        const directory = scratch();
        const before = readdirSync('/dev/fd').length;

        // When - a child writes into two logs
        await run(process.execPath, ['--eval', NODE_WRITES], {
            stderr: { path: join(directory, 'err.log') },
            stdout: { path: join(directory, 'out.log') },
        });

        // Then - none of them stays open
        expect(readdirSync('/dev/fd')).toHaveLength(before);
    });

    test('tells the terminal a command is not there only when stderr is inherited', async () => {
        // Given - the parent's stderr watched
        const stderr = spied(process.stderr);

        // When - a tool no PATH holds is run, its stderr ignored, then inherited
        const lines = (): number => stderr.mock.calls.filter(([chunk]) => chunk === LINE).length;
        const ignored = await run('no-such-tool-anywhere', [], { stderr: 'ignore' });
        const afterIgnored = lines();
        const inherited = await run('no-such-tool-anywhere', [], { stdout: 'ignore' });

        // Then - the shell's status both times, and its line on the terminal for the inherited run alone
        expect([ignored, afterIgnored, inherited, lines()]).toStrictEqual([127, 0, 127, 1]);
    });

    test('drains the parent streams before a child inherits either one', async () => {
        // Given - the parent's two streams watched
        const stdout = spied(process.stdout);
        const stderr = spied(process.stderr);
        const drains = (): number[] =>
            [stdout, stderr].map(
                (write) => write.mock.calls.filter(([chunk]) => chunk === '').length,
            );

        // When - a child inherits stdout, then stderr, then neither
        await run('true', [], { stderr: 'ignore' });
        const afterStdout = drains();
        await run('true', [], { stdout: 'ignore' });
        const afterStderr = drains();
        await run('true', [], { stderr: 'ignore', stdout: 'ignore' });

        // Then - both streams are drained for each inheriting child, and for that one alone
        expect([afterStdout, afterStderr, drains()]).toStrictEqual([
            [1, 1],
            [2, 2],
            [2, 2],
        ]);
    });

    test.each(['SIGHUP', 'SIGINT', 'SIGTERM'] as const)(
        'hands %s on to the command it hands the terminal over to',
        async (signal) => {
            // Given - a command that exits 7 on the signal, once it says it listens
            const ready = join(scratch(), 'ready');
            const status = handOver(process.execPath, [
                '--eval',
                `process.on('${signal}', () => process.exit(7)); require('node:fs').writeFileSync(${JSON.stringify(ready)}, ''); setInterval(() => {}, 1000);`,
            ]);
            await vi.waitFor(() => {
                expect(existsSync(ready)).toBe(true);
            });

            // When - the parent receives the signal
            process.emit(signal, signal);

            // Then - the command received it, and its status is the parent's
            await expect(status).resolves.toBe(7);
        },
    );

    test('hands the terminal over: the command runs in the folder named, on the parent streams, and the parent stops forwarding once it ends', async () => {
        // Given - a folder, and a command writing where it runs and which files its streams are
        const folder = realpathSync(scratch());
        const seen = join(folder, 'seen.json');

        // When - the terminal is handed over to it in that folder
        const status = await handOver(
            process.execPath,
            [
                '--eval',
                `const { fstatSync, writeFileSync } = require('node:fs'); writeFileSync(${JSON.stringify(seen)}, JSON.stringify([process.cwd(), fstatSync(1).ino, fstatSync(2).ino]));`,
            ],
            folder,
        );

        // Then - it ran there on the parent's own stdout and stderr, and no signal is forwarded any more
        expect([
            status,
            JSON.parse(readFileSync(seen, 'utf8')),
            ['SIGHUP', 'SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal)),
        ]).toStrictEqual([0, [folder, fstatSync(1).ino, fstatSync(2).ino], [0, 0, 0]]);
    });

    test('tells the terminal a command handed over is not there', async () => {
        // Given - the parent's stderr watched
        const stderr = spied(process.stderr);

        // When - the terminal is handed over to a tool no PATH holds
        const status = await handOver('no-such-tool-anywhere', []);

        // Then - the shell's status, and its line on the terminal
        expect([
            status,
            stderr.mock.calls.filter(([chunk]) => chunk === LINE).length,
        ]).toStrictEqual([127, 1]);
    });
});
