export const GROUND_EXPECTED = '_expected';
export const GROUND_FIXTURES = '_fixtures';
export const GROUND_REQUESTS = '_requests';
export const GROUND_SEEDS = '_seeds';

export const GROUND_FOLDERS: readonly string[] = Object.freeze([
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
]);

export const GROUND_GLOBS: readonly string[] = Object.freeze(
    GROUND_FOLDERS.map((folder) => `**/${folder}/**`),
);

export const GROUND_GLOB = `**/{${GROUND_FOLDERS.join(',')}}/**`;

export const SHARED_FOLDER = '_shared';

export const SETUP_FOLDER = '_setup';

export const RESERVED_FOLDERS: readonly string[] = Object.freeze([
    SETUP_FOLDER,
    ...GROUND_FOLDERS,
    SHARED_FOLDER,
]);

export const UNMARKED_RESERVED: Readonly<Record<string, string>> = Object.freeze({
    doubles: SETUP_FOLDER,
    expected: GROUND_EXPECTED,
    fixtures: GROUND_FIXTURES,
    requests: GROUND_REQUESTS,
    seeds: GROUND_SEEDS,
    setup: SETUP_FOLDER,
    shared: SHARED_FOLDER,
});

export const isGroundFolder = (name: string): boolean => GROUND_FOLDERS.includes(name);

export const isReservedFolder = (name: string): boolean => RESERVED_FOLDERS.includes(name);
