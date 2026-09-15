#!/usr/bin/env node

/**
 * Every place the project told a checker to look away.
 *
 * A suppression is a decision, and a decision the next reader cannot re-derive
 * is a defect waiting to be re-introduced. Three rules hold the whole surface:
 * it is spelled in the vocabulary of the tools this project actually runs, it
 * carries the reason it was taken, and it names a rule that is still live.
 *
 * Usage: node check-suppressions.js [root] [--fix] [--oxlint <path>]
 *        [--ignore-pattern <glob>]…
 *
 * `--fix` rewrites the two spellings a machine can settle: an
 * `eslint-disable*` whose every named rule resolves becomes `oxlint-disable*`,
 * and `@ts-ignore` becomes `@ts-expect-error`. It never invents a reason and it
 * never deletes a directive — both of those are the author's judgement.
 *
 * One line per violation, `<rule>  <path>  <message>`. Exit code: 0 when every
 * suppression is spelled, reasoned and live, 1 otherwise.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, readText, trackedFiles } from './tracked-files.js';

/** What a linter and a type-checker read — the files a directive can live in. */
export const SOURCE = /\.(?:astro|[cm]?[jt]sx?|svelte|vue)$/u;

/** The separator oxlint reads a directive's reason after. */
const REASON = ' -- ';

/**
 * A directive is only a directive where a checker reads one: at the OPENING of
 * a comment. Prose about a suppression, and a string carrying its spelling —
 * this file is made of both — is not a suppression, and neither oxlint nor tsc
 * would treat it as one.
 */
const COMMENT = String.raw`(?:\/\/|\/\*+|^\s*\*(?!\/))\s*`;

/** A disable directive of either vocabulary, with its scope and its tail. */
const DISABLE = new RegExp(
    `${COMMENT}(?<tool>es|ox)lint-disable(?<scope>-next-line|-line)?(?<tail>[^\n*]*)`,
    'gu',
);

/** The two TypeScript directives, with whatever description follows. */
const TS_DIRECTIVE = new RegExp(`${COMMENT}@ts-(?<kind>expect-error|ignore)(?<tail>[^\n*]*)`, 'gu');

/** Biome's, which no project of this toolchain runs. */
const BIOME = new RegExp(`${COMMENT}biome-ignore\\b`, 'u');

/** The rules a directive names: everything before the reason, comma-separated. */
function rulesOf(tail) {
    const named = tail.split(REASON)[0] ?? '';

    return named
        .replace(/\*\/\s*$/u, '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => /^[\w-]+(?:\/[\w-]+)*$/u.test(name) && name !== '');
}

/** Whether the directive carries a reason after the separator oxlint reads. */
const hasReason = (tail) => (tail.split(REASON)[1] ?? '').replace(/\*\/\s*$/u, '').trim() !== '';

/**
 * The rules oxlint resolved for this project, as `name -> level`, plus the
 * plugin namespaces that map knows about. The map holds every rule the config
 * DECIDED, which is not oxlint's whole catalogue: a rule missing from it is a
 * rule this project does not run, which is the only question asked of it.
 *
 * A JS plugin's rules never appear in `--print-config`, so a directive naming
 * one is unverifiable — and the gate says nothing rather than calling a live
 * rule dead.
 */
function resolveConfig(root, oxlint) {
    let printed;
    try {
        printed = execFileSync(oxlint, ['--print-config'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }

    let rules;
    try {
        rules = JSON.parse(printed).rules ?? {};
    } catch {
        return null;
    }

    const namespaces = new Set();
    for (const name of Object.keys(rules)) {
        if (name.includes('/')) {
            namespaces.add(name.split('/')[0]);
        }
    }

    return { namespaces, rules };
}

/** Where a named rule stands for this project: `live`, `dead`, or `unverifiable`. */
function standingOf(name, config) {
    if (config === null) {
        return 'unverifiable';
    }

    const namespace = name.includes('/') ? name.split('/')[0] : null;
    if (namespace !== null && !config.namespaces.has(namespace)) {
        /* A JS plugin's namespace: its rules are absent from --print-config. */
        return 'unverifiable';
    }

    const bare = name.split('/').at(-1);
    const level =
        config.rules[name] ??
        Object.entries(config.rules).find(([key]) => key.split('/').at(-1) === bare)?.[1];

    return level === undefined || level === 'allow' ? 'dead' : 'live';
}

/** Every violation one line carries, and the line a `--fix` would leave behind. */
function auditLine(line, number, config) {
    const found = [];
    let fixed = line;

    for (const audit of [auditBiome, auditDisables, auditTypeScript]) {
        const { fixed: rewritten, found: reported } = audit(fixed, number, config);
        found.push(...reported);
        fixed = rewritten;
    }

    return { fixed, found };
}

/** Biome's spelling, which no project of this toolchain runs and no fix rewrites. */
function auditBiome(line, number) {
    if (!BIOME.test(line)) {
        return { fixed: line, found: [] };
    }

    return {
        fixed: line,
        found: [
            {
                message: `line ${number} spells a suppression for biome, which this toolchain never runs`,
                rule: 'suppressions-spelling',
            },
        ],
    };
}

/** The two linter vocabularies: the spelling, the reason, and the rules named. */
function auditDisables(line, number, config) {
    const found = [];
    let fixed = line;

    for (const match of line.matchAll(DISABLE)) {
        const { scope = '', tail = '', tool } = match.groups;
        const named = rulesOf(tail);

        if (tool === 'es') {
            /* A rewrite is only safe where the name it carries means something here. */
            const settled = isRewritable(named, config);
            if (settled) {
                fixed = fixed.replace(`eslint-disable${scope}`, `oxlint-disable${scope}`);
            }
            found.push(eslintSpelling(number, named, settled));
            continue;
        }

        found.push(...auditOxlintDirective(number, tail, named, config));
    }

    return { fixed, found };
}

/** Whether every rule an eslint directive names is one this project actually runs. */
function isRewritable(named, config) {
    return named.length > 0 && named.every((name) => standingOf(name, config) !== 'dead');
}

/** What an eslint spelling is told — which depends on whether a fix can settle it. */
function eslintSpelling(number, named, settled) {
    return {
        message: settled
            ? `line ${number} spells an eslint directive; this toolchain runs oxlint — 'typescript fix' rewrites it`
            : `line ${number} spells an eslint directive naming ${named.join(', ') || 'no rule'}, which this project does not run — name an oxlint rule`,
        rule: 'suppressions-spelling',
    };
}

/** An oxlint directive: whether it carries its reason, and whether its rules are live. */
function auditOxlintDirective(number, tail, named, config) {
    const found = [];

    if (!hasReason(tail)) {
        found.push({
            message: `line ${number} disables ${named.join(', ') || 'every rule'} with no '${REASON.trim()} reason' after it`,
            rule: 'suppressions-reason',
        });
    }

    for (const name of named) {
        if (standingOf(name, config) === 'dead') {
            found.push({
                message: `line ${number} disables ${name}, which the resolved config does not have on`,
                rule: 'suppressions-dead',
            });
        }
    }

    return found;
}

/** The two TypeScript directives: the spelling that stays silent, and the missing description. */
function auditTypeScript(line, number) {
    const found = [];
    let fixed = line;

    for (const match of line.matchAll(TS_DIRECTIVE)) {
        const { kind, tail = '' } = match.groups;

        if (kind === 'ignore') {
            fixed = fixed.replace('@ts-ignore', '@ts-expect-error');
            found.push({
                message: `line ${number} spells @ts-ignore, which stays silent once the error is gone — @ts-expect-error does not`,
                rule: 'suppressions-spelling',
            });
        }

        if (tail.replace(/\*\/\s*$/u, '').trim() === '') {
            found.push({
                message: `line ${number} carries a TypeScript suppression with no description of what it is for`,
                rule: 'suppressions-reason',
            });
        }
    }

    return { fixed, found };
}

/**
 * One file read and audited: every violation it carries, each marked with
 * whether a `--fix` settles that very line, and the text the rewrite would
 * leave behind — null where nothing changed. A file with no directive spelling
 * anywhere in it is skipped before a single line is parsed.
 */
function auditSource(root, path, configOf) {
    const text = readText(root, path);
    if (text === null || !/(?:es|ox)lint-disable|@ts-|biome-ignore/u.test(text)) {
        return null;
    }

    const kept = [];
    const violations = [];

    for (const [index, line] of text.split('\n').entries()) {
        const { fixed, found } = auditLine(line, index + 1, configOf());
        kept.push(fixed);
        for (const violation of found) {
            violations.push({ ...violation, rewritable: fixed !== line });
        }
    }

    const rewritten = kept.join('\n');

    return { rewritten: rewritten === text ? null : rewritten, violations };
}

/**
 * How many directives the tracked source carries — the number the drift report
 * prints. It lives here because the shapes that count as a directive are this
 * file's, and a second copy of them is a second definition of "suppression".
 */
export function countSuppressions(root, ignorePatterns = []) {
    let found = 0;

    for (const path of trackedFiles(root, { ignorePatterns }).filter((file) => SOURCE.test(file))) {
        const text = readText(root, path);
        if (text === null) {
            continue;
        }
        for (const line of text.split('\n')) {
            found +=
                [...line.matchAll(DISABLE)].length +
                [...line.matchAll(TS_DIRECTIVE)].length +
                (BIOME.test(line) ? 1 : 0);
        }
    }

    return found;
}

/* Imported for `countSuppressions`, run for the gate — never both at once. */
if (import.meta.main) {
    const isFix = argv.includes('--fix');
    const oxlintAt = argv[argv.indexOf('--oxlint') + 1];
    const oxlint = argv.includes('--oxlint') && oxlintAt !== undefined ? oxlintAt : 'oxlint';
    const root = resolve(
        argv.slice(2).find((argument, index) => {
            const previous = argv[index + 1];

            return (
                !argument.startsWith('--') &&
                previous !== '--oxlint' &&
                previous !== '--ignore-pattern'
            );
        }) ?? '.',
    );

    const sources = trackedFiles(root, { ignorePatterns: ignorePatternsOf(argv) }).filter((path) =>
        SOURCE.test(path),
    );

    /* The resolved config costs an oxlint run, so it is read only once a directive asks for it. */
    let config;
    const configOf = () => (config === undefined ? (config = resolveConfig(root, oxlint)) : config);

    let failed = false;
    const rewritten = [];

    for (const path of sources) {
        const audited = auditSource(root, path, configOf);
        if (audited === null) {
            continue;
        }

        for (const violation of audited.violations) {
            if (isFix && violation.rewritable && violation.rule === 'suppressions-spelling') {
                continue;
            }
            stdout.write(`${violation.rule}  ${path}  ${violation.message}\n`);
            failed = true;
        }

        if (isFix && audited.rewritten !== null) {
            writeFileSync(join(root, path), audited.rewritten);
            rewritten.push(path);
        }
    }

    for (const path of rewritten) {
        stdout.write(`${path} rewritten — the directive now names the checker this project runs\n`);
    }

    exit(failed ? 1 : 0);
}
