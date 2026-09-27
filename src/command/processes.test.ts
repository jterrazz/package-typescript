import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { run } from './processes.js';

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
});
