#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, matchesGlob, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import {
    BIOME,
    commentSpansOf,
    DISABLE,
    SOURCE,
    TS_DIRECTIVE,
} from '../../engine/project/comments.js';
import {
    ignorePatternsOf,
    orRefused,
    projectFiles,
    readText,
} from '../../engine/project/project-files.js';

const REASON = ' -- ';

function rulesOf(tail) {
    const named = tail.split(REASON)[0] ?? '';

    return named
        .replace(/\*\/\s*$/u, '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => /^[\w-]+(?:\/[\w-]+)*$/u.test(name) && name !== '');
}

const hasReason = (tail) => (tail.split(REASON)[1] ?? '').replace(/\*\/\s*$/u, '').trim() !== '';

// oxlint reads a glob with no `/` as a basename, matching at any depth.
const asOxlintGlob = (glob) => (glob.includes('/') ? glob : `**/${glob}`);

// A JS plugin's rules never appear in `--print-config`: its directives are unverifiable, never dead.
function resolveConfig(root, oxlint, config) {
    let printed;
    try {
        printed = execFileSync(oxlint, ['--print-config', ...(config ? ['-c', config] : [])], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }

    let resolved;
    try {
        resolved = JSON.parse(printed);
    } catch {
        return null;
    }

    const overrides = (resolved.overrides ?? []).map((override) => ({
        files: [override.files ?? []].flat().map(asOxlintGlob),
        rules: { ...override.rules },
    }));
    const decided = { ...resolved.rules };
    for (const override of overrides) {
        Object.assign(decided, override.rules);
    }

    return { namespaces: namespacesOf(resolved, decided), overrides, rules: { ...resolved.rules } };
}

// A directive is judged by the rules of the file it was written in: overrides match by path, the later wins.
function configAt(path, config) {
    if (config === null) {
        return null;
    }

    const rules = { ...config.rules };
    for (const override of config.overrides) {
        if (override.files.some((glob) => matchesGlob(path, glob))) {
            Object.assign(rules, override.rules);
        }
    }

    return { namespaces: config.namespaces, rules };
}

// With a JS plugin loaded, a namespace oxlint did not print is that plugin's and answers nothing.
function namespacesOf(resolved, rules) {
    const namespaces = new Set();
    for (const name of Object.keys(rules)) {
        if (name.includes('/')) {
            namespaces.add(name.split('/')[0]);
        }
    }

    if ((resolved.jsPlugins?.length ?? 0) === 0) {
        return namespaces;
    }

    const loaded = new Set(resolved.plugins);

    return new Set([...namespaces].filter((namespace) => loaded.has(namespace)));
}

function standingOf(name, config) {
    if (config === null) {
        return 'unverifiable';
    }

    const namespace = name.includes('/') ? name.split('/')[0] : null;
    if (namespace !== null && !config.namespaces.has(namespace)) {
        return 'unverifiable';
    }

    const bare = name.split('/').at(-1);
    const level =
        config.rules[name] ??
        Object.entries(config.rules).find(([key]) => key.split('/').at(-1) === bare)?.[1];
    // A rule carrying options is printed as `[severity, [options]]`.
    const severity = Array.isArray(level) ? level[0] : level;

    return severity === undefined || severity === 'allow' ? 'dead' : 'live';
}

function auditLine(line, number, config, spans) {
    const found = [];
    let fixed = '';
    let from = 0;

    for (const [start, end] of spans) {
        let comment = line.slice(start, end);
        for (const audit of [auditBiome, auditDisables, auditTypeScript]) {
            const { fixed: rewritten, found: reported } = audit(comment, number, config);
            found.push(...reported);
            comment = rewritten;
        }
        fixed += `${line.slice(from, start)}${comment}`;
        from = end;
    }

    return { fixed: `${fixed}${line.slice(from)}`, found };
}

function auditBiome(line, number) {
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

function auditDisables(line, number, config) {
    const found = [];
    let fixed = line;

    for (const match of line.matchAll(DISABLE)) {
        const { scope = '', tail = '', tool } = match.groups;
        const named = rulesOf(tail);

        if (tool === 'es') {
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

function isRewritable(named, config) {
    return named.length > 0 && named.every((name) => standingOf(name, config) !== 'dead');
}

function eslintSpelling(number, named, settled) {
    return {
        message: settled
            ? `line ${number} spells an eslint directive; this toolchain runs oxlint — 'typescript fix' rewrites it`
            : `line ${number} spells an eslint directive naming ${named.join(', ') || 'no rule'}, which this project does not run — name an oxlint rule`,
        rule: 'suppressions/spelled-for-this-toolchain',
    };
}

function auditOxlintDirective(number, tail, named, config) {
    const found = [];

    if (!hasReason(tail)) {
        found.push({
            message: `line ${number} disables ${named.join(', ') || 'every rule'} with no '${REASON.trim()} reason' after it`,
            rule: 'suppressions/states-its-reason',
        });
    }

    for (const name of named) {
        if (standingOf(name, config) === 'dead') {
            found.push({
                message: `line ${number} disables ${name}, which the resolved config does not have on`,
                rule: 'suppressions/no-dead-suppression',
            });
        }
    }

    return found;
}

function auditTypeScript(line, number) {
    const found = [];
    let fixed = line;

    for (const match of line.matchAll(TS_DIRECTIVE)) {
        const { kind, tail = '' } = match.groups;

        if (kind === 'ignore') {
            fixed = fixed.replace('@ts-ignore', '@ts-expect-error');
            found.push({
                message: `line ${number} spells @ts-ignore, which stays silent once the error is gone — @ts-expect-error does not`,
                rule: 'suppressions/spelled-for-this-toolchain',
            });
        }

        if (tail.replace(/\*\/\s*$/u, '').trim() === '') {
            found.push({
                message: `line ${number} carries a TypeScript suppression with no description of what it is for`,
                rule: 'suppressions/states-its-reason',
            });
        }
    }

    return { fixed, found };
}

function auditSource(root, path, configOf) {
    const text = readText(root, path);
    if (text === null || !/(?:es|ox)lint-disable|@ts-|biome-ignore/u.test(text)) {
        return null;
    }

    const config = configAt(path, configOf());
    const kept = [];
    const violations = [];
    const spans = commentSpansOf(text);

    for (const [index, line] of text.split('\n').entries()) {
        const { fixed, found } = auditLine(line, index + 1, config, spans[index] ?? []);
        kept.push(fixed);
        for (const violation of found) {
            violations.push({ ...violation, rewritable: fixed !== line });
        }
    }

    const rewritten = kept.join('\n');

    return { rewritten: rewritten === text ? null : rewritten, violations };
}

if (import.meta.main) {
    const isFix = argv.includes('--fix');
    const oxlintAt = argv[argv.indexOf('--oxlint') + 1];
    const oxlint = argv.includes('--oxlint') && oxlintAt !== undefined ? oxlintAt : 'oxlint';
    const handed = argv.includes('-c') ? argv[argv.indexOf('-c') + 1] : undefined;
    const root = resolve(
        argv.slice(2).find((argument, index) => {
            const previous = argv[index + 1];

            return (
                !argument.startsWith('--') &&
                previous !== '--oxlint' &&
                previous !== '-c' &&
                previous !== '--ignore-pattern'
            );
        }) ?? '.',
    );

    const sources = orRefused(() =>
        projectFiles(root, { ignorePatterns: ignorePatternsOf(argv) }),
    ).filter((path) => SOURCE.test(path));

    let config;
    const configOf = () =>
        config === undefined ? (config = resolveConfig(root, oxlint, handed)) : config;

    let failed = false;
    const rewritten = [];

    for (const path of sources) {
        const audited = auditSource(root, path, configOf);
        if (audited === null) {
            continue;
        }

        for (const violation of audited.violations) {
            if (
                isFix &&
                violation.rewritable &&
                violation.rule === 'suppressions/spelled-for-this-toolchain'
            ) {
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
