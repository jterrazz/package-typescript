import { basename, dirname, join, resolve } from 'node:path';

import type { Context } from '../../engine/checker/pass.js';
import CONFIGS from '../../engine/project/oxlint-config-names.json' with { type: 'json' };

export type Project = {
    configName: string | undefined;
    consumerConfig: null | string;
    defaultProfile: null | string;
    profileName: null | string;
    source: null | string;
};

const FROM_PRESETS = 'fromPresets';

// oxlint's config schema is closed, so a profile cannot carry its name to `--print-config`: the
// config's import is the only evidence — a profile imported by name, or the one `fromPresets` reads off the settings.
function profileOf(
    source: null | string,
    { profileNames, settled }: { profileNames: ReadonlySet<string>; settled: unknown },
): null | string {
    const imported =
        /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/u.exec(
            source ?? '',
        );
    const named = (imported?.groups?.names ?? '').split(',').map((name) => name.trim());
    if (named.includes(FROM_PRESETS)) {
        return typeof settled === 'string' && profileNames.has(settled) ? settled : null;
    }

    return named.find((name) => profileNames.has(name)) ?? null;
}

// Read off the compiled files: loading the manifest loads every plugin the rulebook decides.
export function profileNamesAt(context: Context, profilesAt: null | string): ReadonlySet<string> {
    return new Set(
        profilesAt === null
            ? []
            : (context.list(profilesAt) ?? [])
                  .filter((name) => name.endsWith('.js'))
                  .map((name) => basename(name, '.js')),
    );
}

export function profileOfProject(
    context: Context,
    profilesAt: null | string,
    { profileNames, settled }: { profileNames: ReadonlySet<string>; settled: unknown },
): Project {
    const handedAt = context.value('-c');
    const handed = handedAt === undefined ? null : resolve(handedAt);
    // The same list the command hands oxlint.
    const configName = CONFIGS.find((name) => context.exists(join(context.root, name)));
    const source = configName === undefined ? null : context.read(join(context.root, configName));
    const handedName = handed === null ? null : basename(handed, '.js');
    const defaultProfile =
        configName === undefined &&
        handed !== null &&
        handedName !== null &&
        dirname(handed) === profilesAt &&
        profileNames.has(handedName)
            ? handedName
            : null;

    return {
        configName,
        consumerConfig: configName === undefined ? handed : null,
        defaultProfile,
        profileName: defaultProfile ?? profileOf(source, { profileNames, settled }),
        source,
    };
}
