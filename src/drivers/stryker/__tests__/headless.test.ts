import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { headlessEnvironment } from '../headless.js';

const URL = 'http://127.0.0.1:1/';

// invariant: the real opener is never on this PATH: behind the refusing openers stand recording ones, so an opener that let a URL through is a line in `opened.txt`, never a window.
function underTheSandbox(): { env: NodeJS.ProcessEnv; opened: () => string[] } {
    const root = mkdtempSync(join(tmpdir(), 'headless-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    const recording = join(root, 'recording');
    const record = join(root, 'opened.txt');
    mkdirSync(recording);
    for (const name of ['open', 'xdg-open']) {
        writeFileSync(join(recording, name), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${record}'\n`);
        chmodSync(join(recording, name), 0o755);
    }
    const env = { ...headlessEnvironment(join(root, 'headless'), recording), HOME: root };

    return {
        env,
        opened: () => (existsSync(record) ? String(readFileSync(record)).trim().split('\n') : []),
    };
}

describe('headless', () => {
    test('refuses `open` and `xdg-open` first on the PATH, and launches nothing', () => {
        // Given - the sandbox's environment, a recording opener behind it
        const { env, opened } = underTheSandbox();

        // When - a check runs both openers on a URL
        const runs = ['open', 'xdg-open'].map((opener) => {
            const { status, stderr } = spawnSync(opener, [URL], { encoding: 'utf8', env });

            return { status, stderr };
        });

        // Then - each refuses, saying why, and nothing behind it was asked
        expect({ opened: opened(), runs }).toStrictEqual({
            opened: [],
            runs: [
                { status: 1, stderr: `a check may not open a browser: open ${URL}\n` },
                { status: 1, stderr: `a check may not open a browser: xdg-open ${URL}\n` },
            ],
        });
    });

    test('refuses the `open` package, and launches nothing', () => {
        // Given - the sandbox's environment, a recording opener behind it
        const { env, opened } = underTheSandbox();

        // When - a script opens the URL through the package and waits for the opener's verdict
        const { stdout } = spawnSync(
            process.execPath,
            [
                '--input-type=module',
                '--eval',
                `const { default: open } = await import('open');
await open(${JSON.stringify(URL)}, { wait: true }).then(
    () => process.stdout.write('opened'),
    () => process.stdout.write('refused'),
);`,
            ],
            { cwd: dirname(import.meta.dirname), encoding: 'utf8', env },
        );

        // Then - the package's opener refused, and nothing behind it was asked
        expect({ opened: opened(), stdout }).toStrictEqual({ opened: [], stdout: 'refused' });
    });
});
