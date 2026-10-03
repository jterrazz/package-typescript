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

    return (preset.lawSettings ?? []).find(
        (key) =>
            Object.hasOwn(own, key) &&
            JSON.stringify(mergeSettings(settings[key], own[key]).value) !==
                JSON.stringify(settings[key]),
    );
}
