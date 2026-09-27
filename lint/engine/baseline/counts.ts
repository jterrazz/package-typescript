import { objectOf, stringOf } from '../project/json.js';
import type { Counts } from './section.js';

export type Diagnostic = { code: null | string; message: null | string };

// `@jterrazz/test` records and judges these: its oxlint plugin's rules and its checker's ids.
const TEST_NAMESPACES = ['jterrazz/', 'jterrazz-check/'];

// oxlint's "Unused eslint/oxlint-disable directive" findings carry no `code` at all.
const UNUSED_DIRECTIVE = /^Unused (?:eslint|oxlint)-disable directive/u;

function ruleOf(diagnostic: Diagnostic): string {
    const { code } = diagnostic;
    if (code === null && UNUSED_DIRECTIVE.test(diagnostic.message ?? '')) {
        return 'oxlint/unused-directive';
    }
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null
        ? (code ?? 'unknown')
        : `${match.groups?.plugin ?? ''}/${match.groups?.rule ?? ''}`;
}

export function isTestOwned(rule: string): boolean {
    return TEST_NAMESPACES.some((namespace) => rule.startsWith(namespace));
}

export function diagnosticsOf(report: unknown): Diagnostic[] {
    const diagnostics: unknown = Array.isArray(report) ? report : objectOf(report).diagnostics;

    return (Array.isArray(diagnostics) ? diagnostics : []).map((entry) => {
        const { code, message } = objectOf(entry);

        return { code: stringOf(code), message: stringOf(message) };
    });
}

export function countsOf(...reports: unknown[]): Counts {
    const counts: Counts = {};
    for (const report of reports) {
        for (const diagnostic of diagnosticsOf(report)) {
            const rule = ruleOf(diagnostic);
            if (!isTestOwned(rule)) {
                counts[rule] = (counts[rule] ?? 0) + 1;
            }
        }
    }

    return counts;
}
