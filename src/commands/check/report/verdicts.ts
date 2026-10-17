import { appendFileSync, readFileSync } from 'node:fs';

import { readSettings } from '../../../../lint/index.rules.js';
import { labelOf } from '../../../../lint/kit/baseline/baseline-file.js';
import { checker } from '../../../drivers/checker/checker.js';
import { secondsAdded, secondsSince, slowestOf } from '../passes/launched.js';
import type { Timed, TimedLaunch } from '../passes/launched.js';
import type { PresetRun } from '../passes/presets.js';
import type { Check } from '../passes/setup.js';
import type { Started } from '../passes/started.js';
import { lintVerdict } from './lint-verdict.js';
import type { LintVerdict } from './lint-verdict.js';
import { joined } from './logs.js';

export type Verdict = { log: string; seconds: number; status: number; writes?: boolean };

type Passed = undefined | Verdict;

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

async function heldSummaryOf(): Promise<null | RegExp> {
    const { resolved } = await readSettings('.');
    const toolchain = new Set(
        resolved.presets
            .filter((preset) => preset.package === '@jterrazz/typescript')
            .flatMap((preset) => preset.baseline ?? []),
    );
    const labels = resolved.baseline
        .filter((section) => !toolchain.has(section))
        .map((section) => escaped(labelOf(section)));

    return labels.length === 0
        ? null
        : new RegExp(
              `^(?:${labels.join('|')}): (?:\\d+ held across \\d+ rules?|nothing held)$`,
              'u',
          );
}

export async function settled(launched: TimedLaunch | undefined): Promise<Passed> {
    return launched === undefined
        ? undefined
        : { log: launched.log, seconds: await launched.seconds, status: await launched.status };
}

export type Linted = { seconds: number; status: number };

export async function settledLint(check: Check, passes: Started): Promise<Linted> {
    const linted = await passes.lint.status;
    // Stryker disable ConditionalExpression,BlockStatement,ObjectLiteral: a run that did not select the linter prints no lint verdict, so whether its baseline runs, and what this hands back, changes nothing the run reports
    if (!check.selected('oxlint')) {
        return { seconds: await passes.lint.seconds, status: linted };
    }
    // Stryker restore ConditionalExpression,BlockStatement,ObjectLiteral
    const from = performance.now();
    const log = check.logs.at('baseline.log');
    // Stryker disable next-line ArrayDeclaration,StringLiteral: the baseline checker resolves a missing or an empty root to the working directory, which '.' names
    const held = await checker('baseline', ['.'], { path: log });
    appendFileSync(check.logs.at('lint.log'), readFileSync(log));
    const lintSeconds = await passes.lint.seconds;
    const seconds = secondsAdded(lintSeconds, secondsSince(from));

    return { seconds, status: linted === 0 ? held : linted };
}

async function presetVerdict(
    check: Check,
    log: string,
    runs: readonly (PresetRun & Timed)[],
): Promise<Verdict> {
    const outcomes = await Promise.all(
        runs.map(async ({ log: part, seconds, status }) => ({
            log: part,
            seconds: await seconds,
            status: await status,
        })),
    );
    const failed = outcomes.flatMap((outcome) => (outcome.status === 0 ? [] : [outcome.log]));
    joined(check.logs, log, failed);
    const summary = await heldSummaryOf();
    const rootLog = runs.find(({ root }) => root)?.log;
    const summaries =
        failed.length === 0 && rootLog !== undefined && summary !== null
            ? check.logs
                  .read(rootLog)
                  .split('\n')
                  .filter((line) => summary.test(line))
            : [];
    if (summaries.length > 0) {
        appendFileSync(log, summaries.map((line) => `${line}\n`).join(''));
    }

    return {
        log,
        seconds: slowestOf(outcomes),
        status: failed.length === 0 ? 0 : 1,
        // Stryker disable next-line ConditionalExpression,EqualityOperator: a passing preset's log holds only the summaries appended to it, so one printed with none is empty and prints nothing
        writes: summaries.length > 0,
    };
}

export async function presetVerdicts(
    check: Check,
    runs: readonly (PresetRun & Timed)[],
): Promise<(Verdict & { label: string })[]> {
    const labels = [...new Set(runs.map(({ label }) => label))];

    return await Promise.all(
        labels.map(async (label, index) => {
            const verdict = await presetVerdict(
                check,
                check.logs.at(`presets-${String(index)}.log`),
                runs.filter((run) => run.label === label),
            );

            return Object.assign(verdict, { label });
        }),
    );
}

export async function publishVerdict(check: Check, runs: readonly TimedLaunch[]): Promise<Passed> {
    if (runs.length === 0) {
        return undefined;
    }
    const outcomes = await Promise.all(
        runs.map(async (launched) => ({
            seconds: await launched.seconds,
            status: await launched.status,
        })),
    );
    const statuses = outcomes.map(({ status }) => status);
    const log = check.logs.at('publish.log');
    joined(
        check.logs,
        log,
        runs.map(({ log: part }) => part),
    );

    return {
        log,
        seconds: slowestOf(outcomes),
        status: statuses.some((status) => status !== 0) ? 1 : 0,
        writes: true,
    };
}

export function lintVerdictOf(
    check: Check,
    { seconds, status }: Linted,
): (LintVerdict & { seconds: number }) | undefined {
    return check.selected('oxlint') ? { ...lintVerdict(check, status), seconds } : undefined;
}
