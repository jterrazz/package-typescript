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

const shown = (value: unknown): string => JSON.stringify(value) ?? String(value);

// invariant: replays the merge of a section: a list item keeps the first file that added it, a single value the last that wrote it.
function walk(value: unknown, path: string, origin: string, into: Map<string, Entry>): void {
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
            walk(child, `${path}.${key}`, origin, into);
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

function layersOf(resolved: Resolved, section: string): Layer[] {
    const presets = resolved.presets.filter(({ name }) => name === section);

    return [
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

/** Each setting of the resolved sections, then each law and each one set aside, beside the file it comes from. */
export function originLines(resolved: Resolved): OriginLine[] {
    const settings = Object.keys(resolved.sections).flatMap((section) => {
        const entries = new Map<string, Entry>();
        for (const { origin, settings: layer } of layersOf(resolved, section)) {
            walk(layer, section, origin, entries);
        }

        const byPath = [...entries.values()].toSorted((left, right) =>
            left.path.localeCompare(right.path),
        );

        return grouped(byPath).map(({ list, origin, path, values }) => {
            const shownValues = values.join(', ');

            return { origin, setting: `${path} = ${list ? `[${shownValues}]` : shownValues}` };
        });
    });
    const laws = resolved.presets.flatMap((preset) =>
        [...(preset.layers ?? []), ...(preset.names ?? [])].map(({ name }) => ({
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
