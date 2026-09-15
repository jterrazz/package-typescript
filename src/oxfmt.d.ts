/** Where an import statement goes, and in what order — oxfmt's own sorter. */
type SortImports = {
    groups?: (string | string[])[];
    ignoreCase?: boolean;
    internalPattern?: string[];
    newlinesBetween?: boolean;
    order?: 'asc' | 'desc';
};

/** Which class-holding calls `sortTailwindcss` reorders, beyond class/className. */
type SortTailwindcss = {
    attributes?: string[];
    functions?: string[];
};

/** A plain oxfmt configuration object. */
type OxfmtConfig = {
    bracketSpacing?: boolean;
    endOfLine?: 'auto' | 'cr' | 'crlf' | 'lf';
    ignorePatterns?: string[];
    printWidth?: number;
    semi?: boolean;
    singleQuote?: boolean;
    sortImports?: boolean | SortImports;
    sortPackageJson?: boolean | { sortScripts?: boolean };
    sortTailwindcss?: boolean | SortTailwindcss;
    tabWidth?: number;
    trailingComma?: 'all' | 'es5' | 'none';
    useTabs?: boolean;
};

declare const base: OxfmtConfig;

export { defineConfig } from 'oxfmt';
export { base, type OxfmtConfig, type SortImports, type SortTailwindcss };
