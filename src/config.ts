import type { ArchitectureRule } from '../lint/consumer/checks/architecture.js';
import type { NamesRule } from '../lint/consumer/checks/names.declared.js';

/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a sibling package adds its section by merging into this declaration, which a `type` alias cannot take
export interface JterrazzConfig {
    /** What `@jterrazz/typescript` reads. */
    typescript?: TypescriptSettings;
}

export type { ArchitectureRule } from '../lint/consumer/checks/architecture.js';
export type { NamesRule } from '../lint/consumer/checks/names.declared.js';

/** The layer map the Architecture pass holds the import graph to. */
export type ArchitectureSettings = {
    /** The hexagonal map this package ships. */
    hexagonal?: boolean;
    /** The project's own boundaries, each in dependency-cruiser's `from`/`to` vocabulary. */
    layers?: readonly ArchitectureRule[];
};

export type TypescriptPreset = {
    architecture?: Pick<ArchitectureSettings, 'layers'>;
    name: string;
    names?: readonly NamesRule[];
};

/** The `typescript` section of `jterrazz.config.ts`. */
export type TypescriptSettings = {
    architecture?: ArchitectureSettings;
    names?: readonly NamesRule[];
    presets?: readonly TypescriptPreset[];
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Readonly<Record<string, string>>;
};

/** The settings as written, typed: every section a package of the family declares is known here. */
export function defineConfig(config: JterrazzConfig): JterrazzConfig {
    return config;
}
