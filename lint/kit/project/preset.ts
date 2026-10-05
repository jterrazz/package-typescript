import type { IRegularForbiddenRuleType } from 'dependency-cruiser';
import type { OxlintConfig } from 'oxlint';

import type { ChapterAnchor, Unread } from '../catalogue/lesson.js';
import type { EditorFile } from './editor-files.js';
import { isJsonObject, objectOf } from './json.js';
import { lawSettingRefused, writtenLawSetting } from './law-settings.js';
import { optOutsOf } from './opt-outs.js';
import type { OptOut } from './opt-outs.js';
import type { SettingsOrigin } from './origins.js';
import { readProjectKind } from './project-kind.js';
import type { ProjectIdentity } from './project-kind.js';
import { mergeSettings } from './settings-merge.js';

export type ArchitectureRule = Pick<IRegularForbiddenRuleType, 'from' | 'to'> & {
    fix: string;
    name: string;
    read: ChapterAnchor;
    why: string;
};

export type NamesRule = {
    fix: string;
    ignore?: readonly string[];
    ls: Readonly<Record<string, Readonly<Record<string, string>>>>;
    name: string;
    read: ChapterAnchor;
    why: string;
};

export const isChapterAnchor = (value: unknown): value is ChapterAnchor =>
    typeof value === 'string' && /^docs\/.+\.md#.+$/u.test(value);

export type PresetChecker = {
    label: string;
    module: string;
};

export type Preset = {
    baseline?: readonly string[];
    checker?: PresetChecker;
    /** What it derives for its section from a unit's tree, which `typescript doctor` prints beside what the files declare. */
    derive?: (root: string) => Readonly<Record<string, unknown>>;
    files?: Readonly<Record<string, EditorFile>>;
    lawSettings?: readonly string[];
    layers?: readonly ArchitectureRule[];
    name: string;
    names?: readonly NamesRule[];
    /** The files its `settings` are merged from, in order, each named inside its package. */
    origins?: readonly SettingsOrigin[];
    oxlint?: OxlintConfig;
    package: string;
    presets?: readonly Preset[];
    settings?: Readonly<Record<string, unknown>>;
    sources?: { extensions: readonly string[]; roots: readonly string[] };
};

export type { OptOut } from './opt-outs.js';

export type PresetLaw = `${string}/${string}`;

export type BasePresets = (
    declaration: null | ProjectIdentity,
    dependencies?: ReadonlySet<string>,
) => readonly Preset[];

export type Resolved = {
    baseline: string[];
    declaration: null | ProjectIdentity;
    laws: PresetLaw[];
    layers: unknown[];
    names: unknown[];
    optOuts: OptOut[];
    /** The sections as the project's own file writes them, before any default. */
    own: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    presets: Preset[];
    sections: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

export type Resolution = { problem: null | string; resolved: Resolved };

const RESERVED = new Set(['kind', 'optOuts', 'platform', 'presets']);

export const isPreset = (value: unknown): value is Preset =>
    isJsonObject(value) &&
    typeof value.name === 'string' &&
    value.name !== '' &&
    typeof value.package === 'string';

// invariant: depth first: a preset's own presets come before it, and a name met twice keeps its first place.
function flattened(presets: readonly unknown[], into: Map<string, Preset>): null | string {
    for (const preset of presets) {
        if (!isPreset(preset)) {
            return 'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`';
        }
        const nested = flattened(preset.presets ?? [], into);
        if (nested !== null) {
            return nested;
        }
        const known = into.get(preset.name);
        if (known === undefined) {
            into.set(preset.name, preset);
        } else if (known.package !== preset.package) {
            return `holds two presets named \`${preset.name}\`, from ${known.package} and ${preset.package}`;
        }
    }

    return null;
}

const lawOf = (preset: Preset, rule: { name: string }): PresetLaw => `${preset.name}/${rule.name}`;

const EMPTY_DECLARATION = Object.freeze({});

const identityOf = ({ kind, platform }: ProjectIdentity): object =>
    platform === null ? { kind } : { kind, platform };

const EMPTY: Resolved = {
    baseline: [],
    declaration: null,
    laws: [],
    layers: [],
    names: [],
    optOuts: [],
    own: {},
    presets: [],
    sections: {},
};

function occurrencesOf(listed: readonly unknown[], name: string): Preset[] {
    return listed.flatMap((preset) =>
        isPreset(preset)
            ? [
                  // Stryker disable next-line ArrayDeclaration: an entry that is no preset is skipped
                  ...occurrencesOf(preset.presets ?? [], name),
                  ...(preset.name === name ? [preset] : []),
              ]
            : [],
    );
}

// invariant: a listed copy of a base preset only merges its settings into the base, which keeps its first place.
function withBase(listed: readonly unknown[], base: readonly Preset[]): string | unknown[] {
    const presets: unknown[] = [];
    for (const own of base) {
        const named = occurrencesOf(listed, own.name);
        const foreign = named.find((preset) => preset.package !== own.package);
        if (foreign !== undefined) {
            return `holds two presets named \`${own.name}\`, from ${own.package} and ${foreign.package}`;
        }
        let settings: unknown = own.settings;
        for (const preset of named) {
            const law = writtenLawSetting(own, objectOf(own.settings), preset.settings);
            if (law !== undefined) {
                return lawSettingRefused(own.name, law);
            }
            const merged = mergeSettings(settings, preset.settings, own.name);
            if (merged.problem !== null) {
                return merged.problem;
            }
            settings = merged.value;
        }
        presets.push({ ...own, settings: objectOf(settings) });
    }

    return [...presets, ...listed];
}

function orderedPresets(listed: readonly unknown[], base: readonly Preset[]): Preset[] | string {
    const chosen = withBase(listed, base);
    if (typeof chosen === 'string') {
        return chosen;
    }
    const ordered = new Map<string, Preset>();

    return flattened(chosen, ordered) ?? [...ordered.values()];
}

type Sections = {
    own: Record<string, Readonly<Record<string, unknown>>>;
    problem: null | string;
    sections: Record<string, Readonly<Record<string, unknown>>>;
};

const sectionRefused = (problem: string): Sections => ({ own: {}, problem, sections: {} });

function sectionsOf(
    presets: readonly Preset[],
    declared: Readonly<Record<string, unknown>>,
): Sections {
    const names = new Set([
        ...presets.map(({ name }) => name),
        ...Object.keys(declared).filter((key) => !RESERVED.has(key)),
    ]);
    const sections: Record<string, Readonly<Record<string, unknown>>> = {};
    const owned: Record<string, Readonly<Record<string, unknown>>> = {};
    for (const name of [...names].toSorted()) {
        const own = declared[name];
        if (own !== undefined && !isJsonObject(own)) {
            return sectionRefused(`holds a \`${name}\` section that is not an object`);
        }
        if (own !== undefined && Object.hasOwn(own, 'presets')) {
            return sectionRefused(
                `holds a \`presets\` inside its \`${name}\` section, which no reader reads — list every preset at the top level, \`presets: [...]\``,
            );
        }
        let section: unknown = {};
        for (const preset of presets.filter((one) => one.name === name)) {
            section = mergeSettings(section, preset.settings, name).value;
            const law = writtenLawSetting(preset, objectOf(section), own);
            if (law !== undefined) {
                return sectionRefused(lawSettingRefused(name, law));
            }
        }
        const merged = mergeSettings(section, own, name);
        if (merged.problem !== null) {
            return sectionRefused(merged.problem);
        }
        sections[name] = objectOf(merged.value);
        if (own !== undefined) {
            owned[name] = own;
        }
    }

    return { own: owned, problem: null, sections };
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function lawsOf(
    presets: readonly Preset[],
    optOuts: readonly OptOut[],
    pick: (preset: Preset) => readonly { name: string }[] | undefined,
): unknown[] {
    const waived = new Set(optOuts.map(({ law }) => law));

    return presets.flatMap((preset) =>
        (pick(preset) ?? []).filter((rule) => !waived.has(lawOf(preset, rule))),
    );
}

export function resolveConfig(declaredSettings: object, baseOf: BasePresets): Resolution {
    const declared = objectOf(declaredSettings);
    const listed: unknown = declared.presets ?? [];
    // invariant: a file that cannot be resolved still leaves the base laws standing, for what it declares when that much reads.
    const refusedWith = (problem: string, identity: object = EMPTY_DECLARATION): Resolution => ({
        problem,
        resolved: declaredSettings === identity ? EMPTY : resolveConfig(identity, baseOf).resolved,
    });
    const { declaration, problem: undeclared } = readProjectKind(declared);
    if (undeclared !== null) {
        return refusedWith(undeclared);
    }
    const refused = (problem: string): Resolution =>
        refusedWith(problem, declaration === null ? EMPTY_DECLARATION : identityOf(declaration));
    if (!Array.isArray(listed)) {
        return refused('holds a `presets` that is not a list');
    }
    const presets = orderedPresets(listed, baseOf(declaration));
    if (typeof presets === 'string') {
        return refused(presets);
    }
    const { own, problem: unmerged, sections } = sectionsOf(presets, declared);
    const laws = presets.flatMap((preset) =>
        [...(preset.layers ?? []), ...(preset.names ?? [])].map((rule) => lawOf(preset, rule)),
    );
    const opted = optOutsOf(declared.optOuts, new Set(laws));
    const unresolved = unmerged ?? opted.problem;
    if (unresolved !== null) {
        return refused(unresolved);
    }
    const typescript = sections.typescript ?? {};

    return {
        problem: null,
        resolved: {
            baseline: presets.flatMap((preset) => preset.baseline ?? []),
            declaration,
            laws,
            layers: [
                ...lawsOf(presets, opted.optOuts, (preset) => preset.layers),
                ...listOf(objectOf(typescript.architecture).layers),
            ],
            names: [
                ...lawsOf(presets, opted.optOuts, (preset) => preset.names),
                ...listOf(typescript.names),
            ],
            optOuts: opted.optOuts,
            own,
            presets,
            sections,
        },
    };
}

export const presetLesson = (problem: string, file: string): Unread => ({
    fix: `correct ${file} until it loads and each preset and section has its declared shape, then run again`,
    found: `${file} ${problem}`,
    why: 'every law a project is held to is resolved from that file, and a file that cannot be resolved judges nothing',
});
