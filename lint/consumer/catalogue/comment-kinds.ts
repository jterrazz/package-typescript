// invariant: one vocabulary for every comment the toolchain judges: code, style sheets, scripts, workflows.
export const COMMENT_KINDS: readonly string[] = Object.freeze([
    'invariant',
    'hazard',
    'outside',
    'value',
]);

// Stryker disable next-line StringLiteral: the pattern holds no character the unicode flag reads otherwise
export const COMMENT_KIND_OPENING = new RegExp(`^(?:${COMMENT_KINDS.join('|')}): \\S`, 'u');

// outside: the embedded-language highlighters of the editors read a lone lower-case tag in a block comment set before a template literal.
export const LANGUAGE_TAGS: readonly string[] = Object.freeze([
    'css',
    'glsl',
    'gql',
    'graphql',
    'html',
    'js',
    'json',
    'md',
    'sql',
    'svg',
    'ts',
    'wgsl',
    'xml',
    'yaml',
]);

// invariant: what may stand inline with code, and no-inline-comments's ignorePattern: a bundler's annotation and an editor's language tag act where they stand.
export const INLINE_INSTRUCTIONS = String.raw`^\s*(?:[#@]__PURE__|@__NO_SIDE_EFFECTS__|@vite-ignore|webpack[A-Z]\w*:|(?:${LANGUAGE_TAGS.join('|')})\s*$)`;
