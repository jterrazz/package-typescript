import type { IRegularForbiddenRuleType } from 'dependency-cruiser';
import type { OxlintConfig } from 'oxlint';

import type { Unread } from '../catalogue/lesson.js';
import { isJsonObject, objectOf } from './json.js';

export type ArchitectureRule = Pick<IRegularForbiddenRuleType, 'from' | 'to'> & {
    fix: string;
    name: string;
    read: string;
    why: string;
};

export type NamesRule = {
    fix: string;
    ignore?: readonly string[];
    ls: Readonly<Record<string, Readonly<Record<string, string>>>>;
    name: string;
    read: string;
    why: string;
};

export type Preset = {
    baseline?: readonly string[];
    floors?: readonly string[];
    layers?: readonly ArchitectureRule[];
    name: string;
    names?: readonly NamesRule[];
    oxlint?: OxlintConfig;
    package: string;
    presets?: readonly Preset[];
    settings?: Readonly<Record<string, unknown>>;
};

export type OptOut = { law: string; reason: string };

// Each law of a preset is named `<preset>/<rule>`; a repository's own rules follow the laws, unnamed and read as written.
export type Resolved = {
    baseline: string[];
    floors: string[];
    laws: string[];
    layers: unknown[];
    names: unknown[];
    optOuts: OptOut[];
    presets: Preset[];
    sections: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

export type Resolution = { problem: null | string; resolved: Resolved };

const RESERVED = new Set(['optOuts', 'presets']);

const isPreset = (value: unknown): value is Preset =>
    isJsonObject(value) &&
    typeof value.name === 'string' &&
    value.name !== '' &&
    typeof value.package === 'string';

// Depth first: a preset's own presets come before it, and a name met twice keeps its first place.
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

// Lists concatenate with duplicates dropped, records merge key by key, and a value the repository writes wins over a default.
export function mergeSettings(base: unknown, own: unknown): unknown {
    if (own === undefined) {
        return base;
    }
    if (Array.isArray(base) && Array.isArray(own)) {
        const merged = new Set<unknown>(base);
        for (const value of new Set<unknown>(own)) {
            merged.add(value);
        }

        return [...merged];
    }
    if (isJsonObject(base) && isJsonObject(own)) {
        const merged: Record<string, unknown> = { ...base };
        for (const [key, value] of Object.entries(own)) {
            merged[key] = mergeSettings(base[key], value);
        }

        return merged;
    }

    return own;
}

type Named = { name: string };

const lawOf = (preset: Preset, rule: Named): string => `${preset.name}/${rule.name}`;

function optOutsOf(
    declared: unknown,
    laws: ReadonlySet<string>,
): { optOuts: OptOut[]; problem: null | string } {
    if (declared === undefined) {
        return { optOuts: [], problem: null };
    }
    if (!isJsonObject(declared)) {
        return {
            optOuts: [],
            problem: 'holds an `optOuts` that is not an object mapping each law to its reason',
        };
    }
    const optOuts: OptOut[] = [];
    for (const [law, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            return {
                optOuts: [],
                problem: `opts out of \`${law}\` with no reason — say why the repository sets the law aside`,
            };
        }
        if (!laws.has(law)) {
            return {
                optOuts: [],
                problem: `opts out of \`${law}\`, which no preset declares — name a law as \`<preset>/<name>\``,
            };
        }
        optOuts.push({ law, reason });
    }

    return { optOuts, problem: null };
}

const EMPTY_DECLARATION = Object.freeze({});

const EMPTY: Resolved = {
    baseline: [],
    floors: [],
    laws: [],
    layers: [],
    names: [],
    optOuts: [],
    presets: [],
    sections: {},
};

function orderedPresets(
    listed: readonly unknown[],
    base: readonly Preset[],
): { presets: Preset[]; problem: null | string } {
    const ordered = new Map<string, Preset>();
    const byName = new Map(
        listed.filter((preset) => isPreset(preset)).map((preset) => [preset.name, preset]),
    );
    const problem = flattened(
        [
            ...base.map((preset) => byName.get(preset.name) ?? preset),
            ...listed.filter(
                (preset) => !isPreset(preset) || !base.some(({ name }) => name === preset.name),
            ),
        ],
        ordered,
    );

    return { presets: [...ordered.values()], problem };
}

function sectionsOf(
    presets: readonly Preset[],
    declared: Readonly<Record<string, unknown>>,
): { problem: null | string; sections: Record<string, Readonly<Record<string, unknown>>> } {
    const names = new Set([
        ...presets.map(({ name }) => name),
        ...Object.keys(declared).filter((key) => !RESERVED.has(key)),
    ]);
    const sections: Record<string, Readonly<Record<string, unknown>>> = {};
    for (const name of [...names].toSorted()) {
        const own = declared[name];
        if (own !== undefined && !isJsonObject(own)) {
            return { problem: `holds a \`${name}\` section that is not an object`, sections: {} };
        }
        let section: unknown = {};
        for (const preset of presets.filter((one) => one.name === name)) {
            section = mergeSettings(section, preset.settings);
        }
        sections[name] = objectOf(mergeSettings(section, own));
    }

    return { problem: null, sections };
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function lawsOf(
    presets: readonly Preset[],
    optOuts: readonly OptOut[],
    pick: (preset: Preset) => readonly Named[] | undefined,
): unknown[] {
    const waived = new Set(optOuts.map(({ law }) => law));

    return presets.flatMap((preset) =>
        (pick(preset) ?? []).filter((rule) => !waived.has(lawOf(preset, rule))),
    );
}

// `written` is the default export of a settings file, typed by each package's own interface.
export function resolveConfig(written: object, base: readonly Preset[]): Resolution {
    const declared = objectOf(written);
    const listed: unknown = declared.presets ?? [];
    // A file that cannot be resolved still leaves the base laws standing.
    const refusedWith = (problem: string): Resolution => ({
        problem,
        resolved:
            written === EMPTY_DECLARATION ? EMPTY : resolveConfig(EMPTY_DECLARATION, base).resolved,
    });
    if (!Array.isArray(listed)) {
        return refusedWith('holds a `presets` that is not a list');
    }
    const { presets, problem } = orderedPresets(listed, base);
    const { problem: unmerged, sections } = sectionsOf(presets, declared);
    const laws = presets.flatMap((preset) =>
        [...(preset.layers ?? []), ...(preset.names ?? [])].map((rule) => lawOf(preset, rule)),
    );
    const opted = optOutsOf(declared.optOuts, new Set(laws));
    const refused = problem ?? unmerged ?? opted.problem;
    if (refused !== null) {
        return refusedWith(refused);
    }
    const typescript = sections.typescript ?? {};

    return {
        problem: null,
        resolved: {
            baseline: presets.flatMap((preset) => preset.baseline ?? []),
            floors: presets.flatMap((preset) => preset.floors ?? []),
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
            presets,
            sections,
        },
    };
}

export function definePreset(preset: Preset): Preset {
    return preset;
}

export const presetLesson = (problem: string, file: string): Unread => ({
    fix: `correct ${file} until it loads and each preset and section has its declared shape, then run again`,
    found: `${file} ${problem}`,
    why: 'every law a project is held to is resolved from that file, and a file that cannot be resolved judges nothing',
});
