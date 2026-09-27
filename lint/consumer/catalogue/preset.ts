import type { ArchitectureRule, Preset } from '../../engine/project/preset.js';

const READ = 'docs/01-architecture.md#the-judging-layer';

const TEST_MATERIAL = String.raw`\.(?:test|spec|test-d|spec-d|fixtures)\.[cm]?[jt]sx?$`;

export const LINT_LAYERS: readonly ArchitectureRule[] = Object.freeze([
    {
        fix: 'hand the declaration to engine/ from an index, never import it from engine/',
        from: { path: '^lint/engine/' },
        name: 'engine-knows-no-declaration',
        read: READ,
        to: { path: '^(lint/consumer/|lint/self/|lint/index|src/)' },
        why: 'lint/engine/ runs declarations and knows none — it receives them from an index, which it never imports',
    },
    {
        fix: 'move what both folders need into the catalogue or into engine/',
        from: { path: '^lint/consumer/(rulebook|rules|checks)/' },
        name: 'consumer-folders-apart',
        read: READ,
        to: {
            path: '^lint/consumer/(rulebook|rules|checks)/',
            pathNot: '^lint/consumer/$1/',
        },
        why: 'a consumer declaration reads the catalogue and engine/, never a sibling folder',
    },
    {
        fix: 'move what both folders need into the catalogue or into engine/',
        from: { path: '^lint/self/(rules|checks|corpus)/' },
        name: 'self-folders-apart',
        read: READ,
        to: { path: '^lint/self/(rules|checks|corpus)/', pathNot: '^lint/self/$1/' },
        why: 'a self declaration reads its catalogue, consumer/, engine/ and src/, never a sibling folder',
    },
    {
        fix: 'move what the catalogue needs into engine/',
        from: { path: '^lint/(consumer|self)/catalogue/', pathNot: TEST_MATERIAL },
        name: 'catalogue-at-the-bottom',
        read: READ,
        to: { path: '^(lint/consumer|lint/self|src)/', pathNot: '^lint/($1|consumer)/catalogue/' },
        why: 'a catalogue is data at the bottom of the arrow — it reads engine/ and, for the self catalogue, the consumer catalogue it extends; its tests audit what it catalogues',
    },
    {
        fix: 'move what the shipped code needs out of self/ and src/ into engine/',
        from: { path: '^lint/(consumer/|index)' },
        name: 'shipped-lint-reads-no-self',
        read: READ,
        to: { path: '^(lint/self|src)/' },
        why: 'the shipped lint/ never reads self/ (never shipped) nor src/ (the command)',
    },
    {
        fix: 'move what src/ needs into engine/, or compose it in a `lint/` index, and import it from there',
        from: { path: '^src/' },
        name: 'src-reads-no-declaration',
        read: READ,
        to: { path: '^lint/(consumer|self)/' },
        why: 'src/ runs what lint/ declares through its index files and engine/, never a declaration of consumer/ or self/',
    },
]);

export const LINT_TREE = Object.freeze({
    consumer: Object.freeze(['catalogue', 'rulebook', 'rules', 'checks']),
    engine: Object.freeze(['project', 'baseline', 'checker', 'catalogue', 'compiler', 'testing']),
    self: Object.freeze(['catalogue', 'rules', 'checks', 'corpus']),
});

export const SPINE: readonly string[] = Object.freeze(['docs', 'lint', 'skills', 'specs', 'src']);

export const MEMBER_ROOTS: readonly string[] = Object.freeze(['apps', 'packages']);

export const TOOL_ROOTS: Readonly<Record<string, string>> = Object.freeze({
    android: 'React Native and Expo — the native Android project',
    app: 'Next.js App Router and Expo Router — routes are read off this folder',
    bin: "npm — the files a package's `bin` entry links as commands",
    config: "node-config — the default folder its `require('config')` reads",
    ios: 'React Native and Expo — the native iOS project',
    pages: 'Next.js Pages Router — routes are read off this folder',
    prisma: 'Prisma — the schema and migrations its CLI reads by default',
    public: 'Next.js, Astro and Vite — static files served verbatim at the site root',
});

export const WORDS = Object.freeze({
    constructs: Object.freeze(['constants', 'helper', 'interfaces', 'type', 'types', 'util']),
    grabBag: Object.freeze(['base', 'common', 'helpers', 'lib', 'misc', 'stuff', 'tools', 'utils']),
    shortcuts: Object.freeze([
        'auth',
        'cfg',
        'impl',
        'infra',
        'k8s',
        'pkg',
        'repo',
        'repos',
        'svc',
        'tmp',
    ]),
});

export const BASELINE_SECTION = 'typescript';

export const PROFILES = ['astro', 'bun', 'expo', 'next', 'node', 'react'] as const;

export type ProfileName = (typeof PROFILES)[number];

export function typescriptPreset({ profile = 'node' }: { profile?: ProfileName } = {}): Preset {
    return {
        layers: LINT_LAYERS,
        name: 'typescript',
        package: '@jterrazz/typescript',
        settings: {
            lint: LINT_TREE,
            memberRoots: MEMBER_ROOTS,
            profile,
            spine: SPINE,
            toolRoots: TOOL_ROOTS,
            words: WORDS,
        },
        baseline: [BASELINE_SECTION],
    };
}
