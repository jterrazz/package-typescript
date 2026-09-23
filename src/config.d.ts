/**
 * A repository's settings for the @jterrazz toolchain family, one section per
 * package. This package owns the file and the `typescript` section; a sibling
 * package adds its own section by merging into this interface:
 *
 *     declare module '@jterrazz/typescript/config' {
 *         interface JterrazzConfig {
 *             test?: TestSettings;
 *         }
 *     }
 */
export interface JterrazzConfig {
    /** What `@jterrazz/typescript` reads. */
    typescript?: TypescriptSettings;
}

/** The `typescript` section of `jterrazz.config.ts`. */
export interface TypescriptSettings {
    /**
     * The root folders the repository keeps beside the spine, each mapped to
     * the reason it keeps it — the Names (tree) pass refuses an entry with no
     * reason, and one whose folder holds no file.
     */
    roots?: Readonly<Record<string, string>>;
}

/** The settings as written, typed: every section a package of the family declares is known here. */
export declare function defineConfig(config: JterrazzConfig): JterrazzConfig;
