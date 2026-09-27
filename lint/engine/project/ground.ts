export const GROUND_FOLDERS: readonly string[] = Object.freeze([
    '_fixtures',
    '_expected',
    '_seeds',
    '_requests',
]);

export const GROUND_GLOBS: readonly string[] = Object.freeze(
    GROUND_FOLDERS.map((folder) => `**/${folder}/**`),
);

export const isGroundFolder = (name: string): boolean => GROUND_FOLDERS.includes(name);
