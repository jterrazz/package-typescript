import { join } from 'node:path';

import type { Context, Finding } from '../../engine/checker/pass.js';
import { declaredUnder } from '../../engine/project/jterrazz-config.js';
import type { Section } from '../../engine/project/jterrazz-config.js';
import { ignoredOf, listed, runLsLint } from './names.ls-lint.js';
import type { Failures } from './names.ls-lint.js';

export type NamesRule = {
    fix: string;
    ignore?: readonly string[];
    ls: Readonly<Record<string, Readonly<Record<string, string>>>>;
    name: string;
    read: string;
    why: string;
};

const RULE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const isStrings = (value: unknown): boolean =>
    Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function isNamesRule(value: unknown): value is NamesRule {
    return (
        isRecord(value) &&
        ['fix', 'name', 'read', 'why'].every((key) => typeof value[key] === 'string') &&
        RULE_NAME.test(String(value.name)) &&
        (value.ignore === undefined || isStrings(value.ignore)) &&
        isRecord(value.ls) &&
        Object.values(value.ls).every(
            (rules) =>
                isRecord(rules) && Object.values(rules).every((rule) => typeof rule === 'string'),
        )
    );
}

export function declaredNamesRules({ problem, section }: Section): {
    problem: null | string;
    rules: NamesRule[];
} {
    if (problem !== null) {
        return { problem: null, rules: [] };
    }
    const { declared, problem: presets } = declaredUnder(section, 'names');
    if (presets !== null) {
        return { problem: presets, rules: [] };
    }
    const rules = declared.flatMap((names): unknown[] => (Array.isArray(names) ? names : [names]));
    if (!rules.every((rule) => isNamesRule(rule))) {
        return {
            problem:
                'holds a `names` — its own or a preset’s — whose every entry is not `{ name, ls, why, fix, read }`, the `name` in kebab-case, `ls` mapping each glob to its ls-lint rules, `ignore` a list of globs',
            rules: [],
        };
    }

    return { problem: null, rules };
}

function configOf(
    { ignore = [], ls }: NamesRule,
    { ignorePatterns, units }: { ignorePatterns: readonly string[]; units: readonly string[] },
): string {
    return `${JSON.stringify({
        ignore: [
            ...ignoredOf(ignorePatterns),
            ...units.flatMap((unit) => ignore.map((glob) => `${unit}${glob}`)),
        ],
        ls: Object.fromEntries(
            units.flatMap((unit) =>
                Object.entries(ls).map(([glob, rules]) => [`${unit}${glob}`, rules]),
            ),
        ),
    })}\n`;
}

const extensionOf = (name: string): string => {
    const dot = name.indexOf('.', 1);

    return dot === -1 ? '' : name.slice(dot);
};

const matches = (key: string, extension: string): boolean =>
    new RegExp(`^${key.replaceAll('.', String.raw`\.`).replaceAll('*', '[^.]+')}$`, 'u').test(
        extension,
    );

function filesUnder(key: string, names: readonly string[], keys: ReadonlySet<string>): string[] {
    return names.filter((name) => {
        const extension = extensionOf(name);

        return key === extension || (!keys.has(extension) && matches(key, extension));
    });
}

function refusedOf(
    context: Context,
    rule: NamesRule,
    { failures, swept }: { failures: Failures; swept: ReadonlySet<string> },
): { found: string; path: string }[] {
    const keys = new Set(Object.values(rule.ls).flatMap((rules) => Object.keys(rules)));
    const holdsSwept = (directory: string): boolean =>
        [...swept].some((file) => file.startsWith(`${directory}/`));

    return Object.entries(failures).flatMap(([path, failed]) =>
        Object.entries(failed).flatMap(([key, broken]) => {
            const what = `ls-lint's \`${key}: ${broken.map((one) => one.replace(/ \(found \d+\)$/u, '')).join(' | ')}\``;
            if (key === '.dir') {
                return holdsSwept(path)
                    ? [{ found: `\`${path}/\` breaks ${what}`, path: `${path}/` }]
                    : [];
            }
            const entries = listed(join(context.root, path));
            const files =
                entries === null
                    ? [path]
                    : filesUnder(
                          key,
                          entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
                          keys,
                      ).map((name) => `${path}/${name}`);

            return files
                .filter((file) => swept.has(file))
                .map((file) => ({ found: `\`${file}\` breaks ${what}`, path: file }));
        }),
    );
}

export function declaredNamesFindings(
    context: Context,
    {
        rules,
        swept,
        units,
    }: { rules: readonly NamesRule[]; swept: readonly string[]; units: readonly string[] },
): { findings: Finding[]; problems: string[] } {
    const held = new Set(swept);
    const reported = new Map<string, Finding>();
    const problems: string[] = [];
    for (const rule of rules) {
        const { failures, problem } = runLsLint(
            context.value('--ls-lint', 'ls-lint'),
            context.root,
            configOf(rule, { ignorePatterns: context.ignorePatterns, units }),
        );
        if (problem !== null) {
            problems.push(problem);
        }
        for (const { found, path } of refusedOf(context, rule, { failures, swept: held })) {
            reported.set(`${rule.name} ${path}`, {
                message: [
                    `found: ${found}`,
                    `why: ${rule.why}`,
                    `fix: ${rule.fix}`,
                    `read: ${rule.read}`,
                ].join(' · '),
                path,
                rule: `names/${rule.name}`,
            });
        }
    }

    return {
        findings: [...reported.values()].toSorted((left, right) =>
            left.path < right.path ? -1 : 1,
        ),
        problems,
    };
}
