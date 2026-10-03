import type { BuildEntry } from './kit/project/build-plan.js';
import type { ProjectDeclaration } from './kit/project/declaration.js';
import type { ArchitectureRule, NamesRule, Preset } from './kit/project/preset.js';
import type { ProjectOverride, ProjectRule } from './kit/project/project-oxlint.js';

export type {
    ArchitectureRule,
    NamesRule,
    OptOut,
    Preset,
    PresetChecker,
} from './kit/project/preset.js';
export type { Platform, ProjectDeclaration, ProjectKind } from './kit/project/declaration.js';

/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a sibling package adds its section by merging into this declaration, which a `type` alias cannot take
export interface JterrazzConfig {
    /** Laws of a preset the repository sets aside, each `<preset>/<law>` mapped to the reason it is set aside. */
    optOuts?: Readonly<Record<string, string>>;
    /** The presets the repository is held to, after the toolchain's own, which its kind and platform derive. */
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

type Reasoned = Readonly<Record<string, string>>;

/** The `typescript` section of `jterrazz.config.ts`: every setting the toolchain's tools read, each with its reason. */
export type TypescriptSettings = {
    architecture?: ArchitectureSettings;
    /** Entries the manifest does not name: shipped and loaded by path, or built for this repository's own scripts. */
    build?: {
        dev?: Readonly<Record<string, BuildEntry>>;
        entries?: Readonly<Record<string, BuildEntry>>;
    };
    /** What knip cannot trace, each path or name mapped to the reason it is named. */
    knip?: {
        entry?: Reasoned;
        ignore?: Reasoned;
        ignoreBinaries?: Reasoned;
        ignoreDependencies?: Reasoned;
    };
    /** What `typescript mutation` measures beyond the platform's sources, and what it leaves out: tests that read the sources as text, sources no test can judge. */
    mutation?: { exclude?: Reasoned; ignore?: Reasoned; mutate?: Reasoned };
    names?: readonly NamesRule[];
    /** The rules set apart from the platform's profile, each with its reason. */
    oxlint?: {
        overrides?: readonly ProjectOverride[];
        rules?: Readonly<Record<string, ProjectRule>>;
    };
    /** The paths the formatter leaves alone, each mapped to the reason. */
    oxfmt?: { ignore?: Reasoned };
    /** What the project's tsconfig.json adds to its platform's preset, and why. */
    tsconfig?: {
        compilerOptions?: Readonly<Record<string, unknown>>;
        include?: readonly string[];
        reason: string;
    };
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Reasoned;
};

export type ProjectConfig = JterrazzConfig & ProjectDeclaration;

/** The settings as written, typed: what the project is, then every section a package of the family declares. */
export function defineConfig(config: ProjectConfig): ProjectConfig {
    return config;
}

export function definePreset(preset: Preset): Preset {
    return preset;
}
