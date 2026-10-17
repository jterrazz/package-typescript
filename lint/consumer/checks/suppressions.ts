import { join, matchesGlob } from 'node:path';

import type { Finding, Pass } from '../../kit/checker/pass.js';
import {
    BIOME,
    commentSpansOf,
    DISABLE,
    SOURCE,
    STRYKER_DISABLE,
    TS_DIRECTIVE,
} from '../../kit/project/comments.js';
import { configAt, resolveConfig } from '../../kit/project/oxlint-config.js';
import type { Applied, Resolved } from '../../kit/project/oxlint-config.js';
import { readText } from '../../kit/project/project-files.js';
import { placementOf } from './suppressions.stryker.js';

type Found = { message: string; rule: string };

type Audited = { fixed: string; found: Found[] };

type Span = readonly [number, number];

const REASON = ' -- ';

function rulesOf(tail: string): string[] {
    const named = tail.split(REASON)[0] ?? '';

    return named
        .replace(/\*\/\s*$/u, '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => /^[\w-]+(?:\/[\w-]+)*$/u.test(name) && name !== '');
}

const hasReason = (tail: string): boolean =>
    (tail.split(REASON)[1] ?? '').replace(/\*\/\s*$/u, '').trim() !== '';

// outside: oxlint reads a glob with no `/` as a basename, matching at any depth.
function standingOf(name: string, config: Applied | null): 'dead' | 'live' | 'unverifiable' {
    if (config === null) {
        return 'unverifiable';
    }

    const namespace = name.includes('/') ? (name.split('/')[0] ?? '') : null;
    if (namespace !== null && !config.namespaces.has(namespace)) {
        return 'unverifiable';
    }

    const bare = name.split('/').at(-1);
    const level =
        config.rules[name] ??
        Object.entries(config.rules).find(([key]) => key.split('/').at(-1) === bare)?.[1];
    // outside: a rule carrying options is printed as `[severity, [options]]`.
    const severity: unknown = Array.isArray(level) ? level[0] : level;

    return severity === undefined || severity === 'allow' ? 'dead' : 'live';
}

function auditLine(
    line: string,
    number: number,
    config: Applied | null,
    spans: readonly Span[],
): Audited {
    const found: Found[] = [];
    let fixed = '';
    let from = 0;

    for (const [start, end] of spans) {
        let comment = line.slice(start, end);
        for (const audit of [auditBiome, auditDisables, auditStryker, auditTypeScript]) {
            const { fixed: rewritten, found: reported } = audit(comment, number, config);
            found.push(...reported);
            comment = rewritten;
        }
        fixed += `${line.slice(from, start)}${comment}`;
        from = end;
    }

    return { fixed: `${fixed}${line.slice(from)}`, found };
}

function auditBiome(line: string, number: number): Audited {
    if (!BIOME.test(line)) {
        return { fixed: line, found: [] };
    }

    return {
        fixed: line,
        found: [
            {
                message: `line ${number} spells a suppression for biome, which this toolchain never runs`,
                rule: 'suppressions/spelled-for-this-toolchain',
            },
        ],
    };
}

function auditDisables(line: string, number: number, config: Applied | null): Audited {
    const found: Found[] = [];
    let fixed = line;

    for (const match of line.matchAll(DISABLE)) {
        const { scope = '', tail = '', tool } = match.groups ?? {};
        const named = rulesOf(tail);

        if (tool === 'es') {
            const settled = isRewritable(named, config);
            if (settled) {
                fixed = fixed.replace(`eslint-disable${scope}`, `oxlint-disable${scope}`);
            }
            found.push(eslintSpelling(number, named, settled));
            continue;
        }

        found.push(...auditOxlintDirective(number, tail, named));
    }

    return { fixed, found };
}

function isRewritable(named: readonly string[], config: Applied | null): boolean {
    return named.length > 0 && named.every((name) => standingOf(name, config) !== 'dead');
}

function eslintSpelling(number: number, named: readonly string[], settled: boolean): Found {
    return {
        message: settled
            ? `line ${number} spells an eslint directive; this toolchain runs oxlint, and 'typescript fix' rewrites it`
            : `line ${number} spells an eslint directive naming ${named.join(', ') || 'no rule'}, which this project does not run; name an oxlint rule`,
        rule: 'suppressions/spelled-for-this-toolchain',
    };
}

function auditOxlintDirective(number: number, tail: string, named: readonly string[]): Found[] {
    return hasReason(tail)
        ? []
        : [
              {
                  message: `line ${number} disables ${named.join(', ') || 'every rule'} with no '${REASON.trim()} reason' after it`,
                  rule: 'suppressions/states-its-reason',
              },
          ];
}

const STRYKER_REASON = ':';

// invariant: `all` silences every mutator a later line of code would open there too, so a declared equivalence names the mutators it is about.
function auditStryker(line: string, number: number): Audited {
    const found: Found[] = [];
    for (const match of line.matchAll(STRYKER_DISABLE)) {
        // Stryker disable next-line OptionalChaining: a match of the pattern always carries its groups
        const [named = '', ...reason] = (match.groups?.tail ?? '').split(STRYKER_REASON);
        const mutators = named.split(',').map((name) => name.trim());
        if (mutators.includes('all')) {
            found.push({
                message: `line ${number} disables every mutator; name the ones the code cannot be killed by`,
                rule: 'suppressions/stryker-names-its-mutators',
            });
        }
        if (reason.join(STRYKER_REASON).trim() === '') {
            found.push({
                message: `line ${number} disables ${named.trim()} with no '${STRYKER_REASON} reason' after it`,
                rule: 'suppressions/states-its-reason',
            });
        }
    }

    return { fixed: line, found };
}

function auditTypeScript(line: string): Audited {
    let fixed = line;
    for (const match of line.matchAll(TS_DIRECTIVE)) {
        if (match.groups?.kind === 'ignore') {
            fixed = fixed.replace('@ts-ignore', '@ts-expect-error');
        }
    }

    return { fixed, found: [] };
}

function auditSource(
    root: string,
    path: string,
    configOf: () => null | Resolved,
): null | {
    rewritten: null | string;
    violations: (Found & { line: number; rewritable: boolean })[];
} {
    const text = readText(root, path);
    // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: the probe spares reading a source that holds no directive, and one read whole finds none either; a listed source is a file that reads
    if (text === null || !/(?:es|ox)lint-disable|@ts-|biome-ignore|Stryker disable/u.test(text)) {
        return null;
    }

    const config = configAt(path, configOf());
    const kept: string[] = [];
    const violations: (Found & { line: number; rewritable: boolean })[] = [];
    const spans = commentSpansOf(text);

    for (const [index, line] of text.split('\n').entries()) {
        const { fixed, found } = auditLine(line, index + 1, config, spans[index] ?? []);
        kept.push(fixed);
        for (const violation of found) {
            violations.push({ ...violation, line: index + 1, rewritable: fixed !== line });
        }
    }

    for (const { line, ...placement } of placementOf(text.split('\n'), spans)) {
        // Stryker disable next-line BooleanLiteral: the fix rewrites a violation that is rewritable and of the spelling rule alone, and a placement is never of that rule
        violations.push({ ...placement, line, rewritable: false });
    }
    violations.sort((left, right) => left.line - right.line);

    const rewritten = kept.join('\n');

    return { rewritten: rewritten === text ? null : rewritten, violations };
}

const SPELLING = 'suppressions/spelled-for-this-toolchain';

export const suppressions: Pass = Object.freeze({
    async check(context) {
        const oxlint = context.value('--oxlint', 'oxlint');
        const handed = context.value('-c');
        const verbatim = await context.verbatim();
        // invariant: a root declared verbatim is kept as its author wrote it: no directive in it is spelled for this toolchain.
        const sources = context
            .files()
            .filter(
                (path) =>
                    SOURCE.test(path) && !verbatim.some((pattern) => matchesGlob(path, pattern)),
            );

        let config: null | Resolved | undefined;
        const configOf = (): null | Resolved =>
            config === undefined ? (config = resolveConfig(context.root, oxlint, handed)) : config;

        const findings: Finding[] = [];
        const rewritten: { path: string; text: string }[] = [];
        for (const path of sources) {
            const audited = auditSource(context.root, path, configOf);
            if (audited === null) {
                continue;
            }
            for (const { line, message, rewritable, rule } of audited.violations) {
                findings.push({
                    fixed: rewritable && rule === SPELLING,
                    line,
                    message,
                    path,
                    rule,
                });
            }
            if (context.fix && audited.rewritten !== null) {
                rewritten.push({ path, text: audited.rewritten });
            }
        }

        return {
            after: rewritten.map(
                ({ path }) =>
                    `${path} rewritten: the directive now names the checker this project runs`,
            ),
            findings,
            writes: rewritten.map(({ path, text }) => ({ path: join(context.root, path), text })),
        };
    },
    valued: ['--oxlint', '-c'],
});
