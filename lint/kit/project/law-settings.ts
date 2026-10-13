import { objectOf } from './json.js';
import type { Preset } from './preset.js';
import { mergeSettings } from './settings-merge.js';

export const lawSettingRefused = (name: string, key: string): string =>
    `writes \`${name}.${key}\`, a law the ${name} preset sets — keep a root beside the spine under \`${name}.roots\` with its reason, or set a law aside under \`optOuts\``;

export function writtenLawSetting(
    preset: Preset,
    settings: Readonly<Record<string, unknown>>,
    written: unknown,
): string | undefined {
    const own = objectOf(written);

    // Stryker disable next-line ArrayDeclaration: a list of one key nobody writes finds, as an empty one does, no key
    return (preset.lawSettings ?? []).find(
        (key) =>
            Object.hasOwn(own, key) &&
            JSON.stringify(mergeSettings(settings[key], own[key]).value) !==
                JSON.stringify(settings[key]),
    );
}

// invariant: a section is closed once a preset of its name lists the keys a project may write; a key outside that list and outside the laws is one a release removed or never had.
export function unknownSetting(
    name: string,
    presets: readonly Preset[],
    own: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
    const named = presets.filter((preset) => preset.name === name);
    const writable = named.flatMap((preset) => preset.writableSettings ?? []);
    // Stryker disable next-line ArrayDeclaration: a stand-in key names no setting a project writes
    const known = new Set([...writable, ...named.flatMap((preset) => preset.lawSettings ?? [])]);
    const key = Object.keys(own ?? {}).find((one) => !known.has(one));

    return writable.length === 0 || key === undefined
        ? undefined
        : `writes \`${name}.${key}\`, a setting the ${name} preset does not read — it reads ${writable.map((one) => `\`${one}\``).join(', ')}; a key a release removed is named in its adoption guide`;
}
