import { appendFileSync } from 'node:fs';

import { refusal } from '../../../lint/engine/catalogue/lesson.js';
import { isModulePackage } from './project.js';
import type { Check } from './setup.js';

export type LintVerdict = { log: string; status: number; writes: boolean };

const UNPARSED = 'Failed to parse oxlint configuration file';

const NEW_VIOLATIONS = 'There are new violations not covered by the suppressions file';

const FALLEN = 'There are suppressions that do not occur anymore';

function commonjsConfig(own: string | undefined): string | undefined {
    if (own?.endsWith('.cjs') === true || (own?.endsWith('.js') === true && !isModulePackage())) {
        return own;
    }

    return undefined;
}

function configRefusals(check: Check, printed: string): string[] {
    const { own } = check.configs.oxlint;
    const commonjs = commonjsConfig(own);

    const wrapper = check.logs.read(check.logs.at('fix-wrapper.log'));

    return [
        ...(wrapper === '' ? [] : [wrapper]),
        ...(printed.includes(UNPARSED)
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
    ];
}

// oxlint's own help names a bare `oxlint --suppress-all`, which would lint with another config and without types.
function ratchetLessons(printed: string): string[] {
    return [
        ...(printed.includes(NEW_VIOLATIONS)
            ? [
                  `${refusal({
                      fix: "fix it, or run 'typescript baseline' to record where the project stands — never a bare `oxlint --suppress-all`, which lints with another config",
                      found: 'a diagnostic oxlint-suppressions.json does not hold — each one is listed above',
                      read: 'docs/06-quality-checks.md#the-ratchet',
                      why: 'the file holds the debt the project recorded, file by file, and a diagnostic beyond it is a regression',
                  })}\n`,
              ]
            : []),
        ...(printed.includes(FALLEN)
            ? [
                  `${refusal({
                      fix: "run 'typescript fix', which prunes the file",
                      found: 'oxlint-suppressions.json holds more than the project has left',
                      read: 'docs/06-quality-checks.md#the-ratchet',
                      why: 'the count is exact, so a debt that fell is recorded the day it falls',
                  })}\n`,
              ]
            : []),
    ];
}

export function lintVerdict(check: Check, linted: number): LintVerdict {
    const log = check.logs.at('lint.log');
    const printed = check.logs.read(log);
    const refusals = configRefusals(check, printed);
    const lessons = ratchetLessons(printed);
    for (const line of [...refusals, ...lessons]) {
        appendFileSync(log, line);
    }

    return { log, status: refusals.length > 0 ? 1 : linted, writes: false };
}
