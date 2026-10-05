import { appendFileSync, readFileSync } from 'node:fs';

import { readSettings } from '../../../../lint/index.rules.js';
import { labelOf } from '../../../../lint/kit/baseline/baseline-file.js';
import { checker } from '../../../drivers/checker/checker.js';
import type { Launched } from '../passes/launched.js';
import type { PresetRun } from '../passes/presets.js';
import type { Check } from '../passes/setup.js';
import type { Started } from '../passes/started.js';
import { lintVerdict } from './lint-verdict.js';
import type { LintVerdict } from './lint-verdict.js';
import { joined } from './logs.js';

export type Verdict = { log: string; status: number; writes?: boolean };

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

export async function settled(launched: Launched | undefined): Promise<Passed> {
    return launched === undefined
        ? undefined
        : { log: launched.log, status: await launched.status };
}

export async function settledLint(check: Check, passes: Started): Promise<number> {
    const linted = await passes.lint;
    if (!check.selected('oxlint')) {
        return linted;
    }
    const log = check.logs.at('baseline.log');
    const held = await checker('baseline', ['.'], { path: log });
    appendFileSync(check.logs.at('lint.log'), readFileSync(log));

    return linted === 0 ? held : linted;
}

async function presetVerdict(
    check: Check,
    log: string,
    runs: readonly PresetRun[],
): Promise<Verdict> {
    const outcomes = await Promise.all(runs.map(async (launched) => await settled(launched)));
    const failed = outcomes.flatMap((outcome) =>
        outcome === undefined || outcome.status === 0 ? [] : [outcome.log],
    );
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

    return { log, status: failed.length === 0 ? 0 : 1, writes: summaries.length > 0 };
}

export async function presetVerdicts(
    check: Check,
    runs: readonly PresetRun[],
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

export function lintVerdictOf(check: Check, linted: number): LintVerdict | undefined {
    return check.selected('oxlint') ? lintVerdict(check, linted) : undefined;
}
