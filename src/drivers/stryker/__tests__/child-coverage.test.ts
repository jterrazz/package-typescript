import { spawn } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, onTestFinished, test } from 'vitest';

import { isList, objectOf } from '../../../../lint/kit/project/json.js';
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

// invariant: a run of this suite under the mutation run inherits the reporter in NODE_OPTIONS; the child here carries the one under test alone, or two reporters would hand back each mutant twice.
function reporting(into: string): NodeJS.ProcessEnv {
    const { NODE_OPTIONS: _inherited, ...rest } = process.env;

    return { ...rest, __STRYKER_CHILD_COVERAGE__: into };
}

async function killed(program: string, signal: NodeJS.Signals): Promise<Ended> {
    const { into, reporter } = laid();
    const child = spawn(process.execPath, ['--require', reporter, '--eval', program], {
        env: reporting(into),
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

const SENDS_ITSELF_SIGTERM = `globalThis.__stryker__ = { mutantCoverage: { perTest: {}, static: { 7: 1 } } };
process.kill(process.pid, 'SIGTERM');`;

const STOPS_ITSELF = `globalThis.__stryker__ = { mutantCoverage: { perTest: {}, static: { 7: 1 } } };
console.log('ran');
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);`;

describe('CHILD_COVERAGE_SOURCE', () => {
    test.each(['SIGTERM', 'SIGINT'] as const)(
        'child-coverage — hands back what the process ran when it is sent %s, and dies of that signal',
        async (signal) => {
            // Given - a child that ran mutant 7 and says so, killed within the reporter's first tenth of a second
            const ended = await killed(RAN_MUTANT_SEVEN, signal);

            // Then - the mutant it ran reached the parent, and the child ended by the signal itself
            expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal });
        },
    );

    test('child-coverage — hands back where each function it ran starts, script by script, and nothing of a script it did not load from a file', async () => {
        // Given - a child running a script of its own that calls one of its two functions
        const { into, reporter } = laid();
        const script = join(into, '..', 'work.cjs');
        const text = 'function unused() {}\nfunction work() { return 1; }\nwork();\n';
        writeFileSync(script, text);
        const child = spawn(process.execPath, ['--require', reporter, script], {
            env: reporting(into),
            stdio: 'ignore',
        });

        // When - it ends
        await new Promise<void>((resolve) => {
            child.once('exit', () => {
                resolve();
            });
        });

        // Then - the script's own body and the function it called, at their offsets, under its file URL alone
        const ran = new Map<string, number[]>();
        for (const name of readdirSync(into).filter((one) => one.endsWith('.functions'))) {
            const handed: unknown = JSON.parse(readFileSync(join(into, name), 'utf8'));
            for (const [url, offsets] of Object.entries(objectOf(handed))) {
                const listed = isList(offsets) ? offsets.map(Number) : [];
                ran.set(url, [...(ran.get(url) ?? []), ...listed]);
            }
        }
        const own = ran.get(pathToFileURL(realpathSync(script)).href) ?? [];
        expect([...ran.keys()].filter((url) => !url.startsWith('file:'))).toStrictEqual([]);
        expect(own.toSorted((a, b) => a - b)).toStrictEqual([0, text.indexOf('function work')]);
    });

    test('child-coverage — dies at once of a signal it sends itself, with what it ran handed back', async () => {
        // Given - a child that ran mutant 7 and sends itself SIGTERM as its script ends
        const { into, reporter } = laid();
        const child = spawn(
            process.execPath,
            ['--require', reporter, '--eval', SENDS_ITSELF_SIGTERM],
            { env: reporting(into), stdio: 'ignore' },
        );

        // When - it ends
        const ended = await new Promise<[null | number, NodeJS.Signals | null]>((resolve) => {
            child.once('exit', (code, by) => {
                resolve([code, by]);
            });
        });

        // Then - it died of the signal, not of its own exit, and its mutant reached the parent
        expect([
            ended,
            readdirSync(into)
                .filter((name) => name.endsWith('.json'))
                .map((name): unknown => JSON.parse(readFileSync(join(into, name), 'utf8'))),
        ]).toStrictEqual([[null, 'SIGTERM'], [{ 7: 1 }]]);
    });

    test('child-coverage — leaves the shutdown to a handler the process holds, and reports at its exit', async () => {
        // Given - a child that ran mutant 7 and stops itself on SIGTERM
        // When - it is sent SIGTERM
        const ended = await killed(STOPS_ITSELF, 'SIGTERM');

        // Then - it ended by its own exit, and its mutant was handed back once
        expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal: null });
    });

    test('child-coverage — answers a request to flush with what is new and its sequence number, and withdraws its mark when it ends', async () => {
        // Given - a child that ran mutant 7 and keeps running
        const { into, reporter } = laid();
        const child = spawn(process.execPath, ['--require', reporter, '--eval', RAN_MUTANT_SEVEN], {
            env: reporting(into),
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
