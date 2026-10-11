import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { CHILD_COVERAGE_SOURCE } from '../child-coverage.js';

type Ended = { handed: unknown[]; signal: NodeJS.Signals | null };

function laid(): { into: string; reporter: string } {
    const folder = mkdtempSync(join(tmpdir(), 'child-coverage-'));
    onTestFinished(() => {
        rmSync(folder, { force: true, recursive: true });
    });
    const into = join(folder, 'handed');
    mkdirSync(into);
    const reporter = join(folder, 'child-coverage.cjs');
    writeFileSync(reporter, CHILD_COVERAGE_SOURCE);

    return { into, reporter };
}

async function killed(program: string, signal: NodeJS.Signals): Promise<Ended> {
    const { into, reporter } = laid();
    const child = spawn(process.execPath, ['--require', reporter, '--eval', program], {
        env: { ...process.env, __STRYKER_CHILD_COVERAGE__: into },
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise<void>((resolve) => {
        child.stdout.once('data', () => {
            resolve();
        });
    });
    child.kill(signal);
    const ended = await new Promise<NodeJS.Signals | null>((resolve) => {
        child.once('exit', (_code, by) => {
            resolve(by);
        });
    });

    return {
        handed: readdirSync(into)
            .filter((name) => name.endsWith('.json'))
            .map((name): unknown => JSON.parse(readFileSync(join(into, name), 'utf8'))),
        signal: ended,
    };
}

const RAN_MUTANT_SEVEN = `globalThis.__stryker__ = { mutantCoverage: { perTest: {}, static: { 7: 1 } } };
console.log('ran');
setInterval(() => {}, 1000);`;

const STOPS_ITSELF = `globalThis.__stryker__ = { mutantCoverage: { perTest: {}, static: { 7: 1 } } };
console.log('ran');
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);`;

describe('child-coverage', () => {
    test.each(['SIGTERM', 'SIGINT'] as const)(
        'hands back what the process ran when it is sent %s, and dies of that signal',
        async (signal) => {
            // Given - a child that ran mutant 7 and says so, killed within the reporter's first tenth of a second
            const ended = await killed(RAN_MUTANT_SEVEN, signal);

            // Then - the mutant it ran reached the parent, and the child ended by the signal itself
            expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal });
        },
    );

    test('leaves the shutdown to a handler the process holds, and reports at its exit', async () => {
        // Given - a child that ran mutant 7 and stops itself on SIGTERM
        // When - it is sent SIGTERM
        const ended = await killed(STOPS_ITSELF, 'SIGTERM');

        // Then - it ended by its own exit, and its mutant was handed back once
        expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal: null });
    });

    test('answers a request to flush with what is new and its sequence number, and withdraws its mark when it ends', async () => {
        // Given - a child that ran mutant 7 and keeps running
        const { into, reporter } = laid();
        const child = spawn(process.execPath, ['--require', reporter, '--eval', RAN_MUTANT_SEVEN], {
            env: { ...process.env, __STRYKER_CHILD_COVERAGE__: into },
            stdio: ['ignore', 'pipe', 'inherit'],
        });
        await new Promise<void>((resolve) => {
            child.stdout.once('data', () => {
                resolve();
            });
        });
        const marks = (suffix: string): string[] =>
            readdirSync(into).filter((name) => name.endsWith(suffix));

        // When - the parent asks for a flush at a test's end, and the child answers
        writeFileSync(join(into, 'flush'), '4');
        await expect
            .poll(() => marks('.ack').map((name) => readFileSync(join(into, name), 'utf8')))
            .toStrictEqual(['4']);
        const living = marks('.alive').length;
        child.kill('SIGKILL');
        await new Promise<void>((resolve) => {
            child.once('exit', () => {
                resolve();
            });
        });

        // Then - one live mark while it ran, the pid of the process at its head, its coverage handed back, and the mark of a process that could not withdraw it still standing
        expect([
            living,
            marks('.alive')[0]?.startsWith(`${String(child.pid)}-`),
            marks('.json').length,
        ]).toStrictEqual([1, true, 1]);
    });
});
