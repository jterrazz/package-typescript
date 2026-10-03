import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { run } from './processes.js';

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

describe('processes', () => {
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
            `import { run } from ${JSON.stringify(join(import.meta.dirname, 'processes.ts'))};`,
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
});
