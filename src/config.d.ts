/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
export interface JterrazzConfig {
    /** What `@jterrazz/typescript` reads. */
    typescript?: TypescriptSettings;
}

/** The `typescript` section of `jterrazz.config.ts`. */
export interface TypescriptSettings {
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Readonly<Record<string, string>>;
}

/** The settings as written, typed: every section a package of the family declares is known here. */
export declare function defineConfig(config: JterrazzConfig): JterrazzConfig;
