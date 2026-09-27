/** A repository's settings for the @jterrazz toolchain family; a sibling package adds its section by interface merging. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a sibling package adds its section by merging into this declaration, which a `type` alias cannot take
export interface JterrazzConfig {
    /** What `@jterrazz/typescript` reads. */
    typescript?: TypescriptSettings;
}

/** The `typescript` section of `jterrazz.config.ts`. */
export type TypescriptSettings = {
    /** The root folders kept beside the spine, each mapped to the reason it is kept. */
    roots?: Readonly<Record<string, string>>;
};

/** The settings as written, typed: every section a package of the family declares is known here. */
export function defineConfig(config: JterrazzConfig): JterrazzConfig {
    return config;
}
