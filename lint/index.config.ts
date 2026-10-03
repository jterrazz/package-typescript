import type { ArchitectureRule, NamesRule, Preset } from './kit/project/preset.js';

export { definePreset } from './kit/project/preset.js';
export type { ArchitectureRule, NamesRule, OptOut, Preset } from './kit/project/preset.js';
export { typescriptPreset as typescript } from './consumer/catalogue/preset.js';
export type { ProfileName } from './consumer/catalogue/preset.js';

/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a sibling package adds its section by merging into this declaration, which a `type` alias cannot take
export interface JterrazzConfig {
    /** Laws of a preset the repository sets aside, each `<preset>/<law>` mapped to the reason it is set aside. */
    optOuts?: Readonly<Record<string, string>>;
    /** The presets the repository is held to, after the base `typescript()` preset, which is always on. */
    presets?: readonly Preset[];
    /** What `@jterrazz/typescript` reads. */
    typescript?: TypescriptSettings;
}

/** The layer map the Architecture pass holds the import graph to. */
export type ArchitectureSettings = {
    /** The hexagonal map this package ships. */
    hexagonal?: boolean;
    /** The project's own boundaries, each in dependency-cruiser's `from`/`to` vocabulary. */
    layers?: readonly ArchitectureRule[];
};

/** The `typescript` section of `jterrazz.config.ts`. */
export type TypescriptSettings = {
    architecture?: ArchitectureSettings;
    names?: readonly NamesRule[];
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Readonly<Record<string, string>>;
};

/** The settings as written, typed: every section a package of the family declares is known here. */
export function defineConfig(config: JterrazzConfig): JterrazzConfig {
    return config;
}
