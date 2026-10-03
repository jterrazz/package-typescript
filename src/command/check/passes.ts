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
    'markdown',
    'names',
    'comments',
    'secrets',
    'drift',
] as const;

export type CheckPass = (typeof CHECK_PASSES)[number];

export type Selected = (pass: CheckPass) => boolean;

export const EVERY_PASS: Selected = () => true;
