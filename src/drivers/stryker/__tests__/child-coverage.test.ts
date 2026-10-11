import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { CHILD_COVERAGE_SOURCE } from '../sources.js';

type Ended = { handed: Record<string, number>[]; signal: NodeJS.Signals | null };

function laid(): { into: string; reporter: string } {
    const folder = mkdtempSync(join(tmpdir(), 'child-coverage-'));
    onTestFinished(() => rmSync(folder, { force: true, recursive: true }));
    const into = join(folder, 'handed');
    mkdirSync(into);
    const reporter = join(folder, 'child-coverage.cjs');
    writeFileSync(reporter, CHILD_COVERAGE_SOURCE);

    return { into, reporter };
}

// A child that ran mutant 7 once, says so, and waits; the parent signals it at once.
async function killed(program: string, signal: NodeJS.Signals): Promise<Ended> {
    const { into, reporter } = laid();
    const child = spawn(process.execPath, ['--require', reporter, '--eval', program], {
        env: { ...process.env, __STRYKER_CHILD_COVERAGE__: into },
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve) => child.stdout.once('data', resolve));
    child.kill(signal);
    const ended = await new Promise<NodeJS.Signals | null>((resolve) => {
        child.once('exit', (_code, by) => resolve(by));
    });

    return {
        handed: readdirSync(into).map((name) => JSON.parse(readFileSync(join(into, name), 'utf8'))),
        signal: ended,
    };
}

const RAN_MUTANT_SEVEN = `globalThis.__stryker__ = { mutantCoverage: { perTest: {}, static: { 7: 1 } } };
console.log('ran');
setInterval(() => {}, 1000);`;

describe('the coverage reporter of a spawned process', () => {
    test.each(['SIGTERM', 'SIGINT'] as const)(
        'hands back what the process ran when it is sent %s, and dies of that signal',
        async (signal) => {
            // When - the parent kills a child within the reporter's first tenth of a second
            const ended = await killed(RAN_MUTANT_SEVEN, signal);

            // Then - the mutant it ran reached the parent, and the child ended by the signal itself
            expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal });
        },
    );

    test('leaves the shutdown to a handler the process holds, and reports at its exit', async () => {
        // Given - a child that stops itself on SIGTERM
        const program = `${RAN_MUTANT_SEVEN.replace('setInterval(() => {}, 1000);', '')}
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);`;

        // When - it is sent SIGTERM
        const ended = await killed(program, 'SIGTERM');

        // Then - it ended by its own exit, once, and its mutant was handed back
        expect(ended).toStrictEqual({ handed: [{ 7: 1 }], signal: null });
    });
});
