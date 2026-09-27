export const CHECK_PASSES = [
    'typescript',
    'oxlint',
    'oxfmt',
    'gitignore',
    'knip',
    'conventions',
    'docs',
    'publish',
    'architecture',
    'astro',
    'suppressions',
    'markdown',
    'names',
    'comments',
    'secrets',
    'drift',
] as const;

export type CheckPass = (typeof CHECK_PASSES)[number];

export type Selected = (pass: CheckPass) => boolean;

export const EVERY_PASS: Selected = () => true;
