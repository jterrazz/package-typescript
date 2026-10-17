import { appendFileSync, readFileSync } from 'node:fs';

import { vanishedEntries } from '../../../../lint/kit/baseline/oxlint-suppressions.js';
import { refusal } from '../../../../lint/kit/catalogue/lesson.js';
import { parsedObject } from '../../../../lint/kit/project/json.js';
import type { Check } from '../passes/setup.js';

export type LintVerdict = { log: string; seconds: number; status: number; writes: boolean };

const UNPARSED = 'Failed to parse oxlint configuration file';

const NEW_VIOLATIONS = 'There are new violations not covered by the suppressions file';

const FALLEN = 'There are suppressions that do not occur anymore';

function isModulePackage(): boolean {
    try {
        return parsedObject(readFileSync('package.json', 'utf8')).type === 'module';
    } catch {
        return false;
    }
}

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
                      read: 'docs/reference/quality-checks.md#the-two-refusals-that-are-not-diagnostics',
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
                      read: 'docs/reference/quality-checks.md#the-two-refusals-that-are-not-diagnostics',
                      why: 'oxlint drops a config it cannot load and exits 0, so the run enforces no rule the config names',
                  })}\n`,
              ]),
    ];
}

const WARNED = /Found [1-9]\d* warnings? and|^\S+:\d+:\d+: warning /mu;

function ratchetLessons(printed: string, vanished: readonly string[]): string[] {
    return [
        ...(printed.includes(NEW_VIOLATIONS)
            ? [
                  `${refusal({
                      fix: "fix it, or run 'typescript baseline' to record where the project stands — never a bare `oxlint --suppress-all`, which lints with another config",
                      found: 'a diagnostic .jterrazz/oxlint-suppressions.json does not hold — each one is listed above',
                      read: 'docs/reference/quality-checks.md#the-ratchet',
                      why: 'the file holds the debt the project recorded, file by file, and a diagnostic beyond it is a regression',
                  })}\n`,
              ]
            : []),
        ...(WARNED.test(printed)
            ? [
                  `${refusal({
                      fix: "set the rule to `error` in the config that arms it, then fix the diagnostic or run 'typescript baseline' to record it",
                      found: 'a warn-severity diagnostic — oxlint lists it above',
                      read: 'docs/reference/quality-checks.md#a-warning-is-a-diagnostic',
                      why: '.jterrazz/oxlint-suppressions.json holds errors alone, so no baseline can hold a warning down and it fails the pass on every run',
                  })}\n`,
              ]
            : []),
        ...(printed.includes(FALLEN) || vanished.length > 0
            ? [
                  `${refusal({
                      fix: "run 'typescript fix', which prunes the file",
                      found:
                          vanished.length === 0
                              ? '.jterrazz/oxlint-suppressions.json holds more than the project has left'
                              : `.jterrazz/oxlint-suppressions.json holds entries for files that are gone: ${vanished.join(', ')}`,
                      read: 'docs/reference/quality-checks.md#the-ratchet',
                      why: 'the count is exact, so a debt that fell is recorded the day it falls',
                  })}\n`,
              ]
            : []),
    ];
}

export function lintVerdict(
    check: Check,
    { seconds, status: linted }: { seconds: number; status: number },
): LintVerdict {
    const log = check.logs.at('lint.log');
    const printed = check.logs.read(log);
    const refusals = configRefusals(check, printed);
    const vanished = vanishedEntries('.');
    const lessons = ratchetLessons(printed, vanished);
    for (const line of [...refusals, ...lessons]) {
        appendFileSync(log, line);
    }

    return {
        log,
        seconds,
        status: refusals.length > 0 || vanished.length > 0 ? 1 : linted,
        writes: false,
    };
}
