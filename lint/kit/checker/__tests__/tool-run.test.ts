import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { runGitleaks, runTool, toolOutput } from '../tool-run.js';

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

    test('runGitleaks — stages the regular files at their own paths, runs the tool there, and takes the folder back', () => {
        // Given - a gitleaks that lists the folder it runs in and says where that is, a project holding a file, a nested file, a folder, a link and a file gone
        const bin = scratch();
        const staging = join(bin, 'cwd.txt');
        writeFileSync(
            join(bin, 'gitleaks'),
            `#!/bin/sh\n[ "$1" = version ] && exit 0\npwd > '${staging}'\nfind . -mindepth 1 | sort\necho "$@" >&2\n`,
        );
        chmodSync(join(bin, 'gitleaks'), 0o755);
        vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? ''}`);
        onTestFinished(() => {
            vi.unstubAllEnvs();
        });
        const root = scratch();
        mkdirSync(join(root, 'src'));
        mkdirSync(join(root, 'folder'));
        writeFileSync(join(root, 'a.txt'), 'a');
        writeFileSync(join(root, 'src', 'b.txt'), 'b');
        symlinkSync(join(root, 'a.txt'), join(root, 'link.txt'));

        // When - the files are handed to it
        const run = runGitleaks(root, ['a.txt', 'src/b.txt', 'folder', 'link.txt', 'gone.txt']);

        // Then - only the regular files are there, the tool was told to exit 1 on a leak, and the folder it ran in is gone
        expect(run).toStrictEqual({
            output: './a.txt\n./src\n./src/b.txt\ndir . --no-banner --redact --exit-code 1\n',
            ran: true,
            status: 0,
        });
        expect(existsSync(readFileSync(staging, 'utf8').trim())).toBe(false);
    });

    test('runGitleaks — is nothing where gitleaks is not installed', () => {
        // Given - a PATH holding no gitleaks
        vi.stubEnv('PATH', scratch());
        onTestFinished(() => {
            vi.unstubAllEnvs();
        });

        // Then - there was no run to judge
        expect(runGitleaks(scratch(), ['a.txt'])).toBeNull();
    });
});
