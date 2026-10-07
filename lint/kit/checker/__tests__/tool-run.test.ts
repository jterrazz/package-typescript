import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { runTool, toolOutput } from '../tool-run.js';

function scratch(): string {
    const made = mkdtempSync(join(tmpdir(), 'tool-run-'));
    const directory = realpathSync(made);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}

describe('tool-run', () => {
    test('toolOutput — is what the tool printed on its stdout, run in the project', () => {
        // Given - a tool that prints the directory it runs in, and talks on its stderr
        const root = scratch();

        // Then - the directory alone, as text
        expect(
            toolOutput(
                process.execPath,
                ['-e', "process.stdout.write(process.cwd()); process.stderr.write('noise')"],
                root,
            ),
        ).toBe(root);
    });

    test('toolOutput — is nothing for a tool that fails, whatever it printed first', () => {
        // Given - a tool that prints, then exits 1
        // Then - nothing a caller could read as an answer
        expect(
            toolOutput(
                process.execPath,
                ['-e', "process.stdout.write('half'); process.exit(1)"],
                scratch(),
            ),
        ).toBe('');
    });

    test('runTool — hands back both streams, stdout first, and the status the tool exited with', () => {
        // Given - a tool that talks on both streams and exits 3
        // Then - what it said, that it ran, and its status
        expect(
            runTool(
                'node',
                process.execPath,
                [
                    '-e',
                    String.raw`process.stdout.write('out\n'); process.stderr.write('err\n'); process.exit(3)`,
                ],
                scratch(),
            ),
        ).toStrictEqual({ output: 'out\nerr\n', ran: true, status: 3 });
    });
});
