/** The knip config every project is checked against, before what its manifest, build and settings add. */
export const KNIP_PRESET: Readonly<Record<string, unknown>> = {
    // outside: `typescript mutation` hands Stryker its vitest runner by path, which knip cannot trace.
    ignoreDependencies: [
        '@jterrazz/test',
        '@jterrazz/typescript',
        '@stryker-mutator/vitest-runner',
    ],
    // value: the toolchain's own tools, and the gestures of every repository's Makefile.
    ignoreBinaries: ['gitleaks', 'make', 'oxfmt', 'oxlint'],
    // invariant: an export used in its own file is not dead: a test exports what the same file's `afterAll` reads.
    ignoreExportsUsedInFile: true,
    // outside: the toolchain derives the oxlint config and hands it over; knip's plugin cannot judge it.
    oxlint: false,
    // outside: setting `entry` replaces knip's default, so its two defaults lead; the command adds the build's entries.
    entry: [
        '{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}!',
        'src/{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}!',
        'oxlint.config.ts',
        'oxfmt.config.ts',
        'jterrazz.config.ts',
        'vitest.config.ts',
        // invariant: a `*.cli.ts` is a command run by its path, which no import reaches.
        '**/*.cli.ts',
    ],
};
