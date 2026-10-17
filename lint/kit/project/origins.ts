import type { OxlintConfig } from 'oxlint';

import { isInert } from './inert-laws.js';
import { isJsonObject } from './json.js';
import { SETTINGS_FILE } from './jterrazz-config.js';
import type { Preset, Resolved } from './preset.js';

export type OriginLine = { origin: string; setting: string };

export type SettingsOrigin = {
    file: string;
    /** The names of the laws the file declares. */
    laws?: readonly string[];
    settings: Readonly<Record<string, unknown>>;
};

type Layer = { origin: string; settings: unknown };

type Entry = { list: boolean; origin: string; path: string; values: string[] };

const DERIVED = 'derived from the tree';

const RULEBOOK = '@jterrazz/typescript rulebook';

// invariant: an empty list or record below a section is keyed apart, so a later file's entries at its path never overwrite it.
const EMPTY = '\u0001';

const shown = (value: unknown): string => JSON.stringify(value) ?? String(value);

const isEmpty = (value: unknown): boolean =>
    Array.isArray(value)
        ? value.length === 0
        : isJsonObject(value) && Object.keys(value).length === 0;

// invariant: the oxlint keys merged key by key whose entries are no single value, as the compiler merges them: a later layer replaces each entry whole, since a rule's `[level, options]` tuple is one value; env, globals and options hold single values, shown whole anyway.
const WHOLE_ENTRIES: ReadonlySet<string> = new Set([
    'typescript.oxlint.rules',
    'typescript.oxlint.settings',
]);

// invariant: replays the merge of a section: a list item keeps the first file that added it, a single value the last that wrote it.
function walk(value: unknown, path: string, origin: string, into: Map<string, Entry>): void {
    if (path.includes('.') && isEmpty(value)) {
        into.set(`${path}${EMPTY}`, { list: false, origin, path, values: [shown(value)] });
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const one = shown(item);
            const key = `${path}\u0000${one}`;
            if (!into.has(key)) {
                into.set(key, { list: true, origin, path, values: [one] });
            }
        }
        return;
    }
    if (isJsonObject(value)) {
        for (const [key, child] of Object.entries(value)) {
            if (WHOLE_ENTRIES.has(path)) {
                into.set(`${path}.${key}`, {
                    list: false,
                    origin,
                    path: `${path}.${key}`,
                    values: [shown(child)],
                });
            } else {
                walk(child, `${path}.${key}`, origin, into);
            }
        }
        return;
    }
    into.set(path, { list: false, origin, path, values: [shown(value)] });
}

function grouped(entries: readonly Entry[]): Entry[] {
    const lines: Entry[] = [];
    for (const entry of entries) {
        const last = lines.at(-1);
        if (last?.list === true && last.path === entry.path && last.origin === entry.origin) {
            last.values.push(...entry.values);
        } else {
            lines.push({ ...entry, values: [...entry.values] });
        }
    }

    return lines;
}

const presetOrigin = (preset: Preset, file?: string): string =>
    `${preset.package} ${file ?? `preset ${preset.name}`}`;

// invariant: the oxlint config is the platform's profile of the rulebook, then each preset's fragment, then the project's own.
function oxlintLayers(resolved: Resolved, rulebook: OxlintConfig): Layer[] {
    return [
        {
            origin: RULEBOOK,
            settings: {
                oxlint: { profile: resolved.declaration?.platform ?? 'node', ...rulebook },
            },
        },
        ...resolved.presets.flatMap((preset): Layer[] =>
            preset.oxlint === undefined
                ? []
                : [{ origin: presetOrigin(preset), settings: { oxlint: preset.oxlint } }],
        ),
    ];
}

function layersOf(
    resolved: Resolved,
    section: string,
    { derived, rulebook }: { derived: Derived; rulebook: OxlintConfig },
): Layer[] {
    const presets = resolved.presets.filter(({ name }) => name === section);

    return [
        ...(derived[section] === undefined
            ? []
            : [{ origin: DERIVED, settings: derived[section] }]),
        ...(section === 'typescript' ? oxlintLayers(resolved, rulebook) : []),
        ...presets.flatMap(
            (preset): Layer[] =>
                preset.origins?.map(({ file, settings }) => ({
                    origin: presetOrigin(preset, file),
                    settings,
                })) ?? [{ origin: presetOrigin(preset), settings: preset.settings ?? {} }],
        ),
        { origin: SETTINGS_FILE, settings: resolved.own[section] ?? {} },
    ];
}

/** What a command derives from the tree, by the section it would be written in. */
export type Derived = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

// invariant: an empty list or record shows only where no entry sits at its path or below it.
function filled(entries: ReadonlyMap<string, Entry>): Entry[] {
    const stated = [...entries].filter(([key]) => !key.endsWith(EMPTY)).map(([, { path }]) => path);

    return [...entries].flatMap(([key, entry]) =>
        key.endsWith(EMPTY) &&
        stated.some((path) => path === entry.path || path.startsWith(`${entry.path}.`))
            ? []
            : [entry],
    );
}

/** Each setting of the resolved sections (of the rulebook's profile and of what the tree derives), then each law and each one set aside, beside the file it comes from. */
export function originLines(
    resolved: Resolved,
    {
        derived = {},
        holds = () => true,
        rulebook = {},
    }: { derived?: Derived; holds?: (folder: string) => boolean; rulebook?: OxlintConfig } = {},
): OriginLine[] {
    const sections = [...new Set([...Object.keys(derived), ...Object.keys(resolved.sections)])];
    const settings = sections.flatMap((section) => {
        const entries = new Map<string, Entry>();
        for (const { origin, settings: layer } of layersOf(resolved, section, {
            derived,
            rulebook,
        })) {
            walk(layer, section, origin, entries);
        }

        const byPath = filled(entries).toSorted((left, right) =>
            left.path.localeCompare(right.path),
        );

        return grouped(byPath).map(({ list, origin, path, values }) => {
            const shownValues = values.join(', ');

            return { origin, setting: `${path} = ${list ? `[${shownValues}]` : shownValues}` };
        });
    });
    // invariant: a layer law whose folders the project does not hold refuses no import, so it is no law of this project's: the doctor names the ones that apply.
    const laws = resolved.presets.flatMap((preset) =>
        [
            ...(preset.layers ?? []).filter((layer) => !isInert(layer, holds)),
            ...(preset.names ?? []),
        ].map(({ name }) => ({
            origin: presetOrigin(
                preset,
                preset.origins?.find((origin) => origin.laws?.includes(name) === true)?.file,
            ),
            setting: `law ${preset.name}/${name}`,
        })),
    );
    const optOuts = resolved.optOuts.map(({ law, reason }) => ({
        origin: SETTINGS_FILE,
        setting: `optOut ${law} = ${shown(reason)}`,
    }));

    return [...settings, ...laws, ...optOuts];
}
