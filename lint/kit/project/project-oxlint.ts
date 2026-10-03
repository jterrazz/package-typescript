import type { OxlintConfig } from 'oxlint';

import { isJsonObject, isList } from './json.js';

export type RuleSetting = NonNullable<NonNullable<OxlintConfig['rules']>[string]>;

export type ProjectRule = { level: RuleSetting; reason: string };

export type ProjectOverride = {
    files: string[];
    reason: string;
    rules: Record<string, RuleSetting>;
};

export type ProjectOxlint = {
    overrides: ProjectOverride[];
    problem: null | string;
    reasons: Readonly<Record<string, string>>;
    rules: Record<string, RuleSetting>;
};

const LEVELS: ReadonlySet<unknown> = new Set(['allow', 'deny', 'error', 'off', 'warn', 0, 1, 2]);

const isRuleSetting = (value: unknown): value is RuleSetting =>
    LEVELS.has(value) || (Array.isArray(value) && LEVELS.has(value[0]));

const isReason = (value: unknown): value is string =>
    typeof value === 'string' && value.trim() !== '';

const refused = (problem: string): ProjectOxlint => ({
    overrides: [],
    problem,
    reasons: {},
    rules: {},
});

export const levelOf = (setting: RuleSetting): unknown =>
    Array.isArray(setting) ? setting[0] : setting;

function overridesOf(written: unknown): ProjectOverride[] | string {
    if (written === undefined) {
        return [];
    }
    if (!isList(written)) {
        return 'holds a `typescript.oxlint.overrides` that is not a list';
    }
    const overrides: ProjectOverride[] = [];
    for (const override of written) {
        const { files, reason, rules } = isJsonObject(override) ? override : {};
        if (
            !isList(files) ||
            files.length === 0 ||
            !files.every((glob) => typeof glob === 'string')
        ) {
            return 'holds a `typescript.oxlint.overrides` entry naming no `files`';
        }
        if (!isReason(reason)) {
            return `holds a \`typescript.oxlint.overrides\` entry for ${files.join(', ')} with no \`reason\` — say why those files are judged apart`;
        }
        if (!isJsonObject(rules) || !Object.values(rules).every((one) => isRuleSetting(one))) {
            return `holds a \`typescript.oxlint.overrides\` entry for ${files.join(', ')} whose \`rules\` are not oxlint rule settings`;
        }
        overrides.push({
            files: files.filter((glob): glob is string => typeof glob === 'string'),
            reason,
            rules: Object.fromEntries(
                Object.entries(rules).filter((entry): entry is [string, RuleSetting] =>
                    isRuleSetting(entry[1]),
                ),
            ),
        });
    }

    return overrides;
}

export function projectOxlintOf(section: unknown): ProjectOxlint {
    if (section === undefined) {
        return { overrides: [], problem: null, reasons: {}, rules: {} };
    }
    if (!isJsonObject(section)) {
        return refused('holds a `typescript.oxlint` that is not an object');
    }
    const rules: Record<string, RuleSetting> = {};
    const reasons: Record<string, string> = {};
    const written = section.rules ?? {};
    if (!isJsonObject(written)) {
        return refused('holds a `typescript.oxlint.rules` that is not an object');
    }
    for (const [rule, setting] of Object.entries(written)) {
        const { level, reason } = isJsonObject(setting) ? setting : {};
        if (!isRuleSetting(level) || !isReason(reason)) {
            return refused(
                `sets \`${rule}\` with no \`{ level, reason }\` — a rule the project sets apart from its profile says why`,
            );
        }
        rules[rule] = level;
        reasons[rule] = reason;
    }
    const overrides = overridesOf(section.overrides);

    return typeof overrides === 'string'
        ? refused(overrides)
        : { overrides, problem: null, reasons, rules };
}
