export const CHECK_PASSES = [
    'config',
    'typescript',
    'oxlint',
    'oxfmt',
    'gitignore',
    'knip',
    'presets',
    'docs',
    'publish',
    'architecture',
    'astro',
    'suppressions',
    'comments',
    'markdown',
    'names',
    'secrets',
    'drift',
] as const;

export type CheckPass = (typeof CHECK_PASSES)[number];

export type Selected = (pass: CheckPass) => boolean;

export const EVERY_PASS: Selected = () => true;

/** The passes that mean something where there is no code: the declaration, the artefact folder, the manual's layout, the prose, the names of the tree, the comments of its scripts and the secrets. */
export const CONTENT_PASSES: ReadonlySet<CheckPass> = new Set([
    'comments',
    'config',
    'docs',
    'gitignore',
    'markdown',
    'names',
    'secrets',
]);
