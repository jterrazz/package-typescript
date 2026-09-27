import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import { messageOf, refusal } from '../../../lint/engine/catalogue/lesson.js';
import { oxlintReport } from '../report/report.js';
import { isModulePackage } from './project.js';
import type { Check } from './setup.js';

export type LintVerdict = { log: string; status: number; writes: boolean };

const UNPARSED = 'Failed to parse oxlint configuration file';

function commonjsConfig(own: string | undefined): string | undefined {
    if (own?.endsWith('.cjs') === true || (own?.endsWith('.js') === true && !isModulePackage())) {
        return own;
    }

    return undefined;
}

function lintRefusals(check: Check): string {
    const { own } = check.configs.oxlint;
    const unparsed = ['lint.log', 'lint.json'].some((name) =>
        check.logs.read(check.logs.at(name)).includes(UNPARSED),
    );
    const commonjs = commonjsConfig(own);

    return [
        check.logs.read(check.logs.at('fix-wrapper.log')),
        ...(unparsed
            ? [
                  `oxlint-config-unparsed  ${own ?? ''}  ${refusal({
                      fix: 'repair what oxlint names above — usually a `jsPlugins` entry naming a module that is not there',
                      found: 'oxlint refused this config and linted nothing — its own report is above',
                      read: 'docs/06-quality-checks.md#the-two-refusals-that-are-not-diagnostics',
                      why: 'a run over a config oxlint could not parse enforces no rule, and would read as green',
                  })}\n`,
              ]
            : []),
        ...(commonjs === undefined
            ? []
            : [
                  `oxlint-config-commonjs  ${commonjs}  ${refusal({
                      fix: 'write oxlint.config.ts or .mjs',
                      found: 'a CommonJS config cannot load an ESM preset or plugin',
                      read: 'docs/06-quality-checks.md#the-two-refusals-that-are-not-diagnostics',
                      why: 'oxlint drops a config it cannot load and exits 0, so the run enforces no rule the config names',
                  })}\n`,
              ]),
    ].join('');
}

function drawn(check: Check, ifDiagnostics: boolean): { failed: boolean; shown: string } {
    try {
        return {
            failed: false,
            shown: oxlintReport({
                ifDiagnostics,
                oxlint: check.tools.oxlint,
                stderrFile: check.logs.at('lint.err'),
                stdoutFile: check.logs.at('lint.json'),
            }),
        };
    } catch (error) {
        return { failed: true, shown: `${messageOf(error)}\n` };
    }
}

function withCheckerDiagnostics(check: Check, verdict: LintVerdict): LintVerdict {
    const { failed, shown } = drawn(check, true);
    if (shown === '') {
        return verdict;
    }
    const log = check.logs.at('lint-drawn.log');
    writeFileSync(log, shown);
    if (verdict.writes) {
        appendFileSync(log, readFileSync(verdict.log));
    }

    return { log, status: failed ? 1 : verdict.status, writes: true };
}

export function lintVerdict(
    check: Check,
    {
        checkerStatus,
        held,
        status: linted,
    }: { checkerStatus: number; held: boolean; status: number },
): LintVerdict {
    const lintLog = check.logs.at('lint.log');
    const baselineLog = check.logs.at('baseline.log');
    const refusals = lintRefusals(check);
    const status = refusals === '' ? linted : 1;
    if (refusals !== '') {
        appendFileSync(lintLog, refusals);
    }
    if (!check.fix && status !== 0) {
        const shown = check.logs.at('lint-shown.log');
        writeFileSync(shown, drawn(check, false).shown);
        appendFileSync(shown, readFileSync(lintLog));
        renameSync(shown, lintLog);
    }
    const speaksBaseline = status === 0 && (held || (check.fix && check.logs.holds(baselineLog)));
    const verdict = speaksBaseline
        ? { log: baselineLog, status, writes: true }
        : { log: lintLog, status, writes: false };

    return !check.fix && status === 0 && checkerStatus !== 0
        ? withCheckerDiagnostics(check, verdict)
        : verdict;
}
