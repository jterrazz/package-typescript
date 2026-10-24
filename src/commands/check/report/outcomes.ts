import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { ARTIFACTS } from '../../../../lint/kit/project/build-plan.js';
import { objectOf } from '../../../../lint/kit/project/json.js';
import type { GateVerdict } from './gate-verdict.js';

/** Where every gate appends what each of its passes and test files ended on, from the project's root. */
export const OUTCOMES_FILE = `${ARTIFACTS}/check/outcomes.jsonl`;

/** How long an outcome is kept: long enough to name a test file or a pass that never failed across a month of gates. */
export const KEPT_DAYS = 30;

const DAY_MS = 86_400_000;

/** What one pass of a gate, or one test file of a test run, ended on. */
export type Outcome = {
    at: string;
    command: 'check' | 'fix' | 'mutation' | 'test';
    head: null | string;
    kind: 'file' | 'pass';
    name: string;
    project?: string;
    seconds: number;
    status: 'green' | 'red';
};

const statusOf = (status: number): Outcome['status'] => (status === 0 ? 'green' : 'red');

function parsed(text: string): unknown {
    // Stryker disable BlockStatement: a catch that returns nothing returns undefined, as its body does
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
    // Stryker restore BlockStatement
}

// invariant: a line that names no time it ended, a torn write among them, is kept: the prune drops only what it can date.
const atOf = (line: string): number => {
    const { at } = objectOf(parsed(line));

    return typeof at === 'string' ? Date.parse(at) : Number.NaN;
};

// invariant: outcomes are appended in the order they ended, so the first line that names its time is the oldest, and the file is rewritten only when that line has outlived the days kept.
function pruned(file: string, now: Date): void {
    const lines = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line !== '');
    const oldest = now.getTime() - KEPT_DAYS * DAY_MS;
    const outlived = (line: string): boolean => atOf(line) < oldest;
    const first = lines.find((line) => Number.isFinite(atOf(line)));
    if (first !== undefined && outlived(first)) {
        writeFileSync(
            file,
            lines
                .filter((line) => !outlived(line))
                .map((line) => `${line}\n`)
                .join(''),
        );
    }
}

/** Appends what ended to the project's outcomes, then drops what is older than the days kept. */
export function outcomesRecorded(project: string, outcomes: readonly Outcome[], now: Date): void {
    if (outcomes.length === 0) {
        return;
    }
    const file = join(project, OUTCOMES_FILE);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, outcomes.map((outcome) => `${JSON.stringify(outcome)}\n`).join(''));
    pruned(file, now);
}

/** The outcome of every pass a gate's verdict lists. */
export const passOutcomesOf = (verdict: GateVerdict, now: Date): Outcome[] =>
    verdict.passes.map((pass) => ({
        at: now.toISOString(),
        command: verdict.command,
        head: verdict.head,
        kind: 'pass',
        name: pass.label,
        seconds: pass.seconds,
        status: statusOf(pass.status),
    }));

/** The outcome of a run of the project's test script, as a pass of its own. */
export const testOutcomeOf = (
    { head, seconds, status }: { head: null | string; seconds: number; status: number },
    now: Date,
): Outcome => ({
    at: now.toISOString(),
    command: 'test',
    head,
    kind: 'pass',
    name: 'Tests',
    seconds,
    status: statusOf(status),
});

/** Each test file Vitest last ran, by `<project>:<path>`, with what it recorded of it: its duration in milliseconds and whether it failed. */
export type FileResults = ReadonlyMap<string, string>;

// outside: Vitest keeps, for its sequencer, the duration and the failure of every file it last ran in `<cacheDir>/vitest/<hash>/results.json`, by project then path, the cache folder being the preset's `.artifacts/vitest` or Vite's default `node_modules/.vite`.
const CACHE_FOLDERS = [`${ARTIFACTS}/vitest/vitest`, 'node_modules/.vite/vitest'];

function cachedResultsOf(cache: string): [string, string][] {
    const { projects } = objectOf(parsed(readFileSync(cache, 'utf8')));

    return Object.entries(objectOf(projects)).flatMap(([name, recorded]) =>
        Object.entries(objectOf(objectOf(recorded).files)).map(
            ([path, result]): [string, string] => [`${name}:${path}`, JSON.stringify(result)],
        ),
    );
}

/** What Vitest's results caches hold now, each entry as its text, so two reads tell the files a run between them ran. */
export function fileResultsOf(project: string): FileResults {
    const results = new Map<string, string>();
    for (const folder of CACHE_FOLDERS.map((name) => join(project, name))) {
        const caches = existsSync(folder) ? readdirSync(folder) : [];
        for (const cache of caches.map((hash) => join(folder, hash, 'results.json'))) {
            for (const [key, result] of existsSync(cache) ? cachedResultsOf(cache) : []) {
                results.set(key, result);
            }
        }
    }

    return results;
}

/** The outcome of each file whose result a test run wrote: one it added, or one whose duration or failure it changed. */
export function fileOutcomesOf(
    { after, before }: { after: FileResults; before: FileResults },
    { head, now }: { head: null | string; now: Date },
): Outcome[] {
    return [...after]
        .filter(([key, result]) => before.get(key) !== result)
        .map(([key, result]) => {
            const { duration, failed } = objectOf(parsed(result));
            const [named = '', ...path] = key.split(':');

            return {
                at: now.toISOString(),
                command: 'test',
                head,
                kind: 'file',
                name: path.join(':'),
                project: named,
                seconds: Number(duration) / 1000,
                status: failed === true ? 'red' : 'green',
            };
        });
}
