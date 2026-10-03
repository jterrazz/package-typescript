import { OXFMT_CONFIG, OXLINT_CONFIG } from '../../kit/project/editor-config-names.js';
import type { EditorFile } from '../../kit/project/editor-files.js';
import type { ArchitectureRule, BasePresets, Preset } from '../../kit/project/preset.js';
import type { Platform, ProjectIdentity } from '../../kit/project/project-kind.js';

const READ = 'docs/01-architecture.md#the-judging-layer';

const TEST_MATERIAL = String.raw`\.(?:test|spec|test-d|spec-d|fixtures)\.[cm]?[jt]sx?$`;

export const LINT_LAYERS: readonly ArchitectureRule[] = Object.freeze([
    {
        fix: 'hand the declaration to kit/ from a module at the root of lint/, never import it from kit/',
        from: { path: '^lint/kit/' },
        name: 'kit-knows-no-declaration',
        read: READ,
        to: { path: '^(lint/consumer/|lint/self/|lint/[^/]+$|src/)' },
        why: 'lint/kit/ runs declarations and knows none — it receives them from a module at the root of lint/, which it never imports',
    },
    {
        fix: 'move what both folders need into the catalogue or into kit/',
        from: { path: '^lint/consumer/(rulebook|rules|checks)/' },
        name: 'consumer-folders-apart',
        read: READ,
        to: {
            path: '^lint/consumer/(rulebook|rules|checks)/',
            pathNot: '^lint/consumer/$1/',
        },
        why: 'a consumer declaration reads the catalogue and kit/, never a sibling folder',
    },
    {
        fix: 'move what both folders need into the catalogue or into kit/',
        from: { path: '^lint/self/(rules|checks|corpus)/' },
        name: 'self-folders-apart',
        read: READ,
        to: { path: '^lint/self/(rules|checks|corpus)/', pathNot: '^lint/self/$1/' },
        why: 'a self declaration reads its catalogue, consumer/, kit/ and src/, never a sibling folder',
    },
    {
        fix: 'move what the catalogue needs into kit/',
        from: { path: '^lint/(consumer|self)/catalogue/', pathNot: TEST_MATERIAL },
        name: 'catalogue-at-the-bottom',
        read: READ,
        to: { path: '^(lint/consumer|lint/self|src)/', pathNot: '^lint/($1|consumer)/catalogue/' },
        why: 'a catalogue is data at the bottom of the arrow — it reads kit/ and, for the self catalogue, the consumer catalogue it extends; its tests audit what it catalogues',
    },
    {
        fix: 'move what the shipped code needs out of self/ and src/ into kit/',
        from: { path: '^lint/(consumer/|[^/]+$)', pathNot: TEST_MATERIAL },
        name: 'shipped-lint-reads-no-self',
        read: READ,
        to: { path: '^(lint/self|src)/' },
        why: 'the shipped lint/ never reads self/ (never shipped) nor src/ (the command); its tests are not shipped, and may run a rule through the package that ships it',
    },
    {
        fix: 'move what src/ needs into kit/, or compose it in a module at the root of `lint/`, and import it from there',
        from: { path: '^src/' },
        name: 'src-reads-no-declaration',
        read: READ,
        to: { path: '^lint/(consumer|self)/' },
        why: 'src/ runs what lint/ declares through the modules at the root of lint/ and kit/, never a declaration of consumer/ or self/',
    },
]);

export const LINT_TREE = Object.freeze({
    consumer: Object.freeze(['catalogue', 'rulebook', 'rules', 'checks']),
    kit: Object.freeze(['project', 'baseline', 'checker', 'catalogue', 'compiler', 'testing']),
    self: Object.freeze(['catalogue', 'rules', 'checks', 'corpus']),
});

export const SPINE: readonly string[] = Object.freeze(['docs', 'lint', 'skills', 'specs', 'src']);

export const MEMBER_ROOTS: readonly string[] = Object.freeze(['apps', 'packages']);

type PlatformRoot = { code: boolean; reason: string };

const PUBLIC: PlatformRoot = {
    code: false,
    reason: 'Next.js, Astro and Vite — static files served verbatim at the site root',
};

const APP: PlatformRoot = {
    code: true,
    reason: 'Next.js App Router and Expo Router — routes are read off this folder',
};

export const TOOL_ROOTS: Readonly<Record<string, string>> = Object.freeze({
    bin: "npm — the files a package's `bin` entry links as commands",
    config: "node-config — the default folder its `require('config')` reads",
    prisma: 'Prisma — the schema and migrations its CLI reads by default',
});

export const PLATFORM_ROOTS: Readonly<Record<Platform, Readonly<Record<string, PlatformRoot>>>> =
    Object.freeze({
        astro: { public: PUBLIC },
        bun: {},
        expo: {
            android: { code: false, reason: 'React Native and Expo — the native Android project' },
            app: APP,
            ios: { code: false, reason: 'React Native and Expo — the native iOS project' },
        },
        next: {
            app: APP,
            pages: { code: true, reason: 'Next.js Pages Router — routes are read off this folder' },
            public: PUBLIC,
        },
        node: {},
        react: { public: PUBLIC },
    });

const JSX_PLATFORMS: ReadonlySet<Platform> = new Set(['expo', 'next', 'react']);

function sourcesOf(platform: Platform): NonNullable<Preset['sources']> {
    return {
        extensions: JSX_PLATFORMS.has(platform) ? ['ts', 'tsx'] : ['ts'],
        roots: [
            'src',
            ...Object.entries(PLATFORM_ROOTS[platform])
                .filter(([, root]) => root.code)
                .map(([name]) => name),
        ],
    };
}

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

const TSCONFIG_OF: Readonly<Record<Platform, string>> = Object.freeze({
    astro: 'astro',
    bun: 'node',
    expo: 'expo',
    next: 'next',
    node: 'node',
    react: 'react',
});

const fromTheToolchain = (tool: 'oxfmt' | 'oxlint'): EditorFile => ({
    scope: 'repository',
    text: `import { ${tool}Config } from '@jterrazz/typescript/${tool}';\n\nexport default await ${tool}Config(import.meta.url);\n`,
});

const editorFilesOf = (
    declaration: null | ProjectIdentity,
): Readonly<Record<string, EditorFile>> => ({
    [OXFMT_CONFIG]: fromTheToolchain('oxfmt'),
    [OXLINT_CONFIG]: fromTheToolchain('oxlint'),
    'tsconfig.json': {
        json: {
            extends: `@jterrazz/typescript/tsconfig/${TSCONFIG_OF[declaration?.platform ?? 'node']}`,
        },
        scope: 'unit',
    },
});

export function typescriptPreset(declaration: null | ProjectIdentity): Preset {
    const platformRoots =
        declaration?.platform === undefined || declaration.platform === null
            ? {}
            : Object.fromEntries(
                  Object.entries(PLATFORM_ROOTS[declaration.platform]).map(([name, root]) => [
                      name,
                      root.reason,
                  ]),
              );

    return {
        files: editorFilesOf(declaration),
        lawSettings: ['lint', 'memberRoots', 'spine', 'toolRoots', 'words'],
        layers: LINT_LAYERS,
        name: 'typescript',
        package: '@jterrazz/typescript',
        settings: {
            lint: LINT_TREE,
            memberRoots: MEMBER_ROOTS,
            spine: SPINE,
            toolRoots: { ...TOOL_ROOTS, ...platformRoots },
            words: WORDS,
        },
        baseline: [BASELINE_SECTION],
        sources: sourcesOf(declaration?.platform ?? 'node'),
    };
}

export const basePresetsOf: BasePresets = (declaration) => [typescriptPreset(declaration)];
