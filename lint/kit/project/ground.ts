export const GROUND_EXPECTED = '__expected__';
export const GROUND_FIXTURES = '__fixtures__';
export const GROUND_REQUESTS = '__requests__';
export const GROUND_SEEDS = '__seeds__';

export const GROUND_FOLDERS: readonly string[] = Object.freeze([
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
]);

// outside: the go tool reads a module's `testdata/` and its `*_test.go` files by name, in any folder; a polyglot repository's goldens sit there, and no pass of this toolchain judges or rewrites them.
export const GO_GROUND_FOLDER = 'testdata';

export const GO_TEST_FILE = /_test\.go$/u;

export const GO_GROUND_GLOBS: readonly string[] = Object.freeze([
    `**/${GO_GROUND_FOLDER}/**`,
    '**/*_test.go',
]);

export const GROUND_GLOBS: readonly string[] = Object.freeze([
    ...GROUND_FOLDERS.map((folder) => `**/${folder}/**`),
    ...GO_GROUND_GLOBS,
]);

// invariant: the ground of a test and the output of a run are no source of the project: a run rewrites `.artifacts/` while the architecture pass cruises, and a module that vanishes between two reads is an ENOENT, not a finding.
export const UNCRUISED_PATHS = `(^|/)(${GROUND_FOLDERS.join('|')})/|(^|/)\\.artifacts/`;

export const GROUND_GLOB = `**/{${GROUND_FOLDERS.join(',')}}/**`;

export const SETUP_FOLDER = '__setup__';

export const TESTS_FOLDER = '__tests__';

/** The special folders a `specs/` tree may hold: code in `__setup__/`, data in the four ground folders. */
export const SPECIAL_FOLDERS: readonly string[] = Object.freeze([SETUP_FOLDER, ...GROUND_FOLDERS]);

/** The special folders a code root (`src/`, `lint/`...) may hold: its module tests alone; inside one, the ground its tests read. */
export const CODE_SPECIAL_FOLDERS: readonly string[] = Object.freeze([TESTS_FOLDER]);

/** A name spelt like a special folder, `__<word>__`, whether or not the list holds it. */
export const isSpecialFolderName = (name: string): boolean => /^__[a-z0-9-]+__$/u.test(name);

/** The spellings an earlier release gave a special folder, each with the name that replaced it. */
export const RENAMED_FOLDERS: Readonly<Record<string, string>> = Object.freeze({
    _expected: GROUND_EXPECTED,
    _fixtures: GROUND_FIXTURES,
    _requests: GROUND_REQUESTS,
    _seeds: GROUND_SEEDS,
    _setup: SETUP_FOLDER,
    doubles: SETUP_FOLDER,
    expected: GROUND_EXPECTED,
    fixtures: GROUND_FIXTURES,
    requests: GROUND_REQUESTS,
    seeds: GROUND_SEEDS,
    setup: SETUP_FOLDER,
});

/** The spelling an earlier release gave the folder of what specifications share: its folders now sit at the specs root. */
export const RETIRED_SHARED_FOLDERS: readonly string[] = Object.freeze(['_shared', 'shared']);

export const isGroundFolder = (name: string): boolean => GROUND_FOLDERS.includes(name);

export const isSpecialFolder = (name: string): boolean => SPECIAL_FOLDERS.includes(name);

const TEST_SUFFIX = /\.(?:test|test-d)\.[cm]?[jt]sx?$/u;

const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/u;

const parted = (path: string): { folder: string; name: string } => {
    const slash = path.lastIndexOf('/');

    return { folder: path.slice(0, slash + 1), name: path.slice(slash + 1) };
};

/** Where a module's test sits: `dir/foo.ts` is tested by `dir/__tests__/foo.test.ts`. */
export function moduleTestOf(module: string, suffix = '.test'): string {
    const { folder, name } = parted(module);
    const extension = SOURCE_EXTENSION.exec(name)?.[0] ?? '';

    return `${folder}${TESTS_FOLDER}/${name.slice(0, name.length - extension.length)}${suffix}${extension}`;
}

/** The module a test names, with no extension (`dir/__tests__/foo.test.ts` names `dir/foo`), or `null` for a test outside a `__tests__/`. */
export function moduleStemOfTest(test: string): null | string {
    const { folder, name } = parted(test);
    const parent = folder.slice(0, folder.length - TESTS_FOLDER.length - 1);
    if (`${parent}${TESTS_FOLDER}/` !== folder || !(parent === '' || parent.endsWith('/'))) {
        return null;
    }

    return `${parent}${name.replace(TEST_SUFFIX, '')}`;
}
