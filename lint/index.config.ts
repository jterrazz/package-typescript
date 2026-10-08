import type { ArchitectureRule, NamesRule, Preset } from './kit/project/preset.js';
import type { Platform, ProjectDeclaration } from './kit/project/project-kind.js';
import type { ProjectOverride, ProjectRule } from './kit/project/project-oxlint.js';

export type { OptOut } from './kit/project/opt-outs.js';
export type { ArchitectureRule, NamesRule, Preset, PresetChecker } from './kit/project/preset.js';
export type { Platform, ProjectDeclaration, ProjectKind } from './kit/project/project-kind.js';
export { ownPresets } from './kit/project/own-presets.js';
export type { OwnPresets } from './kit/project/own-presets.js';

/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
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
    /** The hexagonal map this package ships; derived from the tree when unwritten — on where `src/` holds `domain/`, `application/` and `infrastructure/`. */
    hexagonal?: boolean;
    /** The project's own boundaries, each in dependency-cruiser's `from`/`to` vocabulary. */
    layers?: readonly ArchitectureRule[];
};

type Reasoned = Readonly<Record<string, string>>;

/** The `typescript` section of `jterrazz.config.ts`: every setting the toolchain's tools read, each with its reason. */
export type TypescriptSettings = {
    architecture?: ArchitectureSettings;
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
    /** A folder of the unit linted by another platform's profile than the unit's, each with its reason. */
    platforms?: Readonly<Record<string, { platform: Platform; reason: string }>>;
    /** What the project's tsconfig.json adds to its platform's preset, and why. */
    tsconfig?: {
        compilerOptions?: Readonly<Record<string, unknown>>;
        /** Single files the type check reads although no glob reaches them — an ambient `.d.ts` under node_modules. */
        files?: readonly string[];
        /** Globs written beside the preset's, never in their place. */
        include?: readonly string[];
        reason: string;
    };
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Reasoned;
    /** The root folders a script writes, each mapped to its reason: kept beside the spine as a root is, and left alone by the formatter. */
    generated?: Reasoned;
};

export type ProjectConfig = JterrazzConfig & ProjectDeclaration;

/** The settings of the `typescript` section no project writes: the laws of the tree, and what the platform's code is. */
export type TypescriptLaws = {
    lint?: Readonly<Record<string, readonly string[]>>;
    memberRoots?: readonly string[];
    /** The folders the platform's code sits in, and its file extensions. */
    sources?: { extensions: readonly string[]; roots: readonly string[] };
    spine?: readonly string[];
    toolRoots?: Readonly<Record<string, string>>;
    /** The tsconfig preset of the platform, `@jterrazz/typescript/tsconfig/<name>`. */
    tsconfigPreset?: string;
    words?: Readonly<Record<string, readonly string[]>>;
};

/** A package's standard: the defaults of the sections `jterrazz.config.ts` writes, and the laws it holds every project to — data only. */
export type Standard = Omit<JterrazzConfig, 'optOuts' | 'presets' | 'typescript'> & {
    /** The laws a project sets aside by name, as `<preset>/<law>`, under `optOuts`. */
    laws?: { layers?: readonly ArchitectureRule[]; names?: readonly NamesRule[] };
    typescript?: TypescriptLaws & TypescriptSettings;
};

/** The settings as written, typed: what the project is, then every section a package of the family declares. */
export function defineConfig(config: ProjectConfig): ProjectConfig {
    return config;
}

export function definePreset(preset: Preset): Preset {
    return preset;
}

/** A standard as written under a package's `src/standard/`, typed as the settings file it defaults. */
export function defineStandard(standard: Standard): Standard {
    return standard;
}
