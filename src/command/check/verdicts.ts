import { appendFileSync, readFileSync } from 'node:fs';

import { checker } from '../checker.js';
import type { Launched } from './launched.js';
import { lintVerdict } from './lint-verdict.js';
import type { LintVerdict } from './lint-verdict.js';
import { joined } from './logs.js';
import { oxlintJson } from './runners.js';
import type { Check } from './setup.js';
import type { Conventions, Runs, Started } from './started.js';

export type Verdict = { log: string; status: number; writes?: boolean };

type Passed = undefined | Verdict;

const HELD_SUMMARY =
    /^jterrazz\.baseline\.json › test: (?:\d+ held across \d+ rules?|nothing held)$/u;

export async function settled(launched: Launched | undefined): Promise<Passed> {
    return launched === undefined
        ? undefined
        : { log: launched.log, status: await launched.status };
}

type HeldLint = { held: boolean; status: number };

async function judgedLint(check: Check, linted: number): Promise<HeldLint> {
    const judgement = check.fix
        ? ['--fix']
        : [
              '--linter-exit',
              String(linted),
              '--names',
              check.logs.at('names.json'),
              '--comments',
              check.logs.at('comments.json'),
          ];
    const baselineLog = check.logs.at('baseline.log');
    const status = await checker('baseline', [check.logs.at('lint.json'), '.', ...judgement], {
        path: baselineLog,
    });
    const held = status === 0 && !check.fix;
    if (!held) {
        appendFileSync(check.logs.at('lint.log'), readFileSync(baselineLog));
    }

    return { held, status };
}

export async function settledLint(check: Check, runs: Runs, passes: Started): Promise<number> {
    const linted = await passes.lint;
    if (check.fix && runs.oxlint) {
        await oxlintJson(check, ['--type-aware', ...check.lintArgs], {
            report: check.logs.at('lint.json'),
            stderr: 'ignore',
        });
    }
    await Promise.all([settled(passes.names), settled(passes.comments)]);

    return linted;
}

export async function heldLint(check: Check, linted: number): Promise<HeldLint> {
    return check.selected('oxlint')
        ? await judgedLint(check, linted)
        : { held: false, status: linted };
}

export async function commentsVerdict(check: Check, passes: Started): Promise<Passed> {
    if (!check.fix || !check.selected('comments')) {
        return await settled(passes.comments);
    }
    const log = check.logs.at('comments.log');

    return {
        log,
        status: await checker('comments', ['.', ...check.lintArgs, '--fix'], { path: log }),
    };
}

export async function conventionsVerdict(
    check: Check,
    { rootLog, runs }: Conventions,
): Promise<Passed> {
    if (runs.length === 0) {
        return undefined;
    }
    const outcomes = await Promise.all(runs.map(async (launched) => await settled(launched)));
    const failed = outcomes.flatMap((outcome) =>
        outcome === undefined || outcome.status === 0 ? [] : [outcome.log],
    );
    const log = check.logs.at('checker.log');
    joined(check.logs, log, failed);
    const summaries =
        failed.length === 0 && rootLog !== undefined
            ? check.logs
                  .read(rootLog)
                  .split('\n')
                  .filter((line) => HELD_SUMMARY.test(line))
            : [];
    if (summaries.length > 0) {
        appendFileSync(log, summaries.map((line) => `${line}\n`).join(''));
    }

    return { log, status: failed.length === 0 ? 0 : 1, writes: summaries.length > 0 };
}

export async function publishVerdict(check: Check, runs: readonly Launched[]): Promise<Passed> {
    if (runs.length === 0) {
        return undefined;
    }
    const statuses = await Promise.all(runs.map(async ({ status }) => await status));
    const log = check.logs.at('publish.log');
    joined(
        check.logs,
        log,
        runs.map(({ log: part }) => part),
    );

    return { log, status: statuses.some((status) => status !== 0) ? 1 : 0, writes: true };
}

export function lintPass(
    check: Check,
    lint: HeldLint,
    conventions: Passed,
): LintVerdict | undefined {
    return check.selected('oxlint')
        ? lintVerdict(check, {
              checkerStatus: conventions?.status ?? 0,
              held: lint.held,
              status: lint.status,
          })
        : undefined;
}
