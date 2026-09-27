import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import { oxlintReport } from '../report/report.js';
import { isModulePackage } from './project.js';
import type { Check } from './setup.js';

export type LintVerdict = { log: string; status: number; writes: boolean };

const UNPARSED = 'Failed to parse oxlint configuration file';

// oxlint drops a config it cannot load and still exits 0; a CommonJS config cannot load an ESM preset or plugin.
function commonjsConfig(own: string | undefined): string | undefined {
    if (own?.endsWith('.cjs') === true || (own?.endsWith('.js') === true && !isModulePackage())) {
        return own;
    }

    return undefined;
}

// A config oxlint cannot parse lints nothing; a CommonJS one is dropped whole with exit 0. Both fail the pass.
function configRefusals(check: Check): string {
    const { own } = check.configs.oxlint;
    const unparsed = ['lint.log', 'lint.json'].some((name) =>
        check.logs.read(check.logs.at(name)).includes(UNPARSED),
    );
    const commonjs = commonjsConfig(own);

    return [
        ...(unparsed
            ? [
                  `oxlint-config-unparsed  ${own ?? ''}  oxlint refused this config and linted nothing — its own report is above\n`,
              ]
            : []),
        ...(commonjs === undefined
            ? []
            : [
                  `oxlint-config-commonjs  ${commonjs}  a CommonJS config cannot load an ESM preset or plugin, and oxlint drops what it cannot load — write oxlint.config.ts or .mjs\n`,
              ]),
    ].join('');
}

function drawn(check: Check, ifDiagnostics: boolean): string {
    return oxlintReport({
        ifDiagnostics,
        oxlint: check.tools.oxlint,
        stderrFile: check.logs.at('lint.err'),
        stdoutFile: check.logs.at('lint.json'),
    });
}

// @jterrazz/test's checker leaves printing its `jterrazz(*)` diagnostics to this pass, even when it is green.
function withCheckerDiagnostics(check: Check, verdict: LintVerdict): LintVerdict {
    const shown = drawn(check, true);
    if (shown === '') {
        return verdict;
    }
    const log = check.logs.at('lint-drawn.log');
    writeFileSync(log, shown);
    if (verdict.writes) {
        appendFileSync(log, readFileSync(verdict.log));
    }

    return { log, status: verdict.status, writes: true };
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
    const refusals = configRefusals(check);
    const status = refusals === '' ? linted : 1;
    if (refusals !== '') {
        appendFileSync(lintLog, refusals);
    }
    if (!check.fix && status !== 0) {
        const shown = check.logs.at('lint-shown.log');
        writeFileSync(shown, drawn(check, false));
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
