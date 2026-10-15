import APPIUM_XCUITEST_DRIVER from '../../../src/standard/dependencies/appium-xcuitest-driver.js';
import ASTRO_CHECK from '../../../src/standard/dependencies/astro-check.js';
import ASTRO_REACT from '../../../src/standard/dependencies/astro-react.js';
import PATCH_PACKAGE from '../../../src/standard/dependencies/patch-package.js';
import PRISMA from '../../../src/standard/dependencies/prisma.js';
import REACT_ROUTER_DEV from '../../../src/standard/dependencies/react-router-dev.js';
import REMOTION from '../../../src/standard/dependencies/remotion.js';
import TYPES_VSCODE from '../../../src/standard/dependencies/types-vscode.js';
import VITE from '../../../src/standard/dependencies/vite.js';
import API from '../../../src/standard/kinds/api.js';
import CLI from '../../../src/standard/kinds/cli.js';
import LIBRARY from '../../../src/standard/kinds/library.js';
import MOBILE from '../../../src/standard/kinds/mobile.js';
import WEBSITE from '../../../src/standard/kinds/website.js';
import ASTRO from '../../../src/standard/platforms/astro.js';
import BROWSER from '../../../src/standard/platforms/browser.js';
import BUN from '../../../src/standard/platforms/bun.js';
import EXPO from '../../../src/standard/platforms/expo.js';
import NEXT from '../../../src/standard/platforms/next.js';
import NODE from '../../../src/standard/platforms/node.js';
import REACT from '../../../src/standard/platforms/react.js';
import STANDARD from '../../../src/standard/standard.js';
import type { Standard } from '../../index.config.js';
import { OXFMT_CONFIG, OXLINT_CONFIG } from '../../kit/project/editor-config-names.js';
import type { EditorFile } from '../../kit/project/editor-files.js';
import { laidOutHexagonally } from '../../kit/project/hexagonal-layout.js';
import { objectOf, stringsOf } from '../../kit/project/json.js';
import type { BasePresets, Preset } from '../../kit/project/preset.js';
import type { Platform, ProjectIdentity, ProjectKind } from '../../kit/project/project-kind.js';
import { mergeSettings } from '../../kit/project/settings-merge.js';

const KIND_STANDARDS: Readonly<Record<ProjectKind, Standard>> = {
    api: API,
    cli: CLI,
    library: LIBRARY,
    mobile: MOBILE,
    website: WEBSITE,
};

const PLATFORM_STANDARDS: Readonly<Record<Platform, Standard>> = {
    astro: ASTRO,
    browser: BROWSER,
    bun: BUN,
    expo: EXPO,
    next: NEXT,
    node: NODE,
    react: REACT,
};

// invariant: a package keyed here brings its standard to every unit whose manifest declares it, named for the package, on the platforms it lists when it lists any.
const DEPENDENCY_STANDARDS: Readonly<
    Record<string, { name: string; platforms?: readonly Platform[]; standard: Standard }>
> = {
    '@astrojs/check': { name: 'astro-check', standard: ASTRO_CHECK },
    '@astrojs/react': { name: 'astro-react', standard: ASTRO_REACT },
    '@prisma/client': { name: 'prisma', standard: PRISMA },
    '@types/vscode': { name: 'types-vscode', standard: TYPES_VSCODE },
    '@react-router/dev': { name: 'react-router-dev', standard: REACT_ROUTER_DEV },
    'appium-xcuitest-driver': { name: 'appium-xcuitest-driver', standard: APPIUM_XCUITEST_DRIVER },
    'patch-package': { name: 'patch-package', standard: PATCH_PACKAGE },
    remotion: { name: 'remotion', standard: REMOTION },
    vite: { name: 'vite', platforms: ['react'], standard: VITE },
};

export const BASELINE_SECTION = 'typescript';

const fromTheToolchain = (tool: 'oxfmt' | 'oxlint'): EditorFile => ({
    scope: 'repository',
    text: `import { ${tool}Config } from '@jterrazz/typescript/${tool}';\n\nexport default await ${tool}Config(import.meta.url);\n`,
});

const editorFilesOf = (tsconfigPreset: unknown): Readonly<Record<string, EditorFile>> => ({
    [OXFMT_CONFIG]: fromTheToolchain('oxfmt'),
    [OXLINT_CONFIG]: fromTheToolchain('oxlint'),
    'tsconfig.json': {
        json: { extends: `@jterrazz/typescript/tsconfig/${String(tsconfigPreset)}` },
        scope: 'unit',
    },
});

// invariant: the merge order of the standard: the package's, then the kind's, then the platform's, then each declared dependency's — a monorepo root and an undeclared project read the node platform's.
function standardsOf(
    declaration: null | ProjectIdentity,
    dependencies: ReadonlySet<string>,
): StandardOrigin[] {
    const platform = declaration?.platform ?? 'node';

    return [
        { file: 'src/standard/standard.ts', standard: STANDARD },
        ...(declaration?.kind === null || declaration?.kind === undefined
            ? []
            : [
                  {
                      file: `src/standard/kinds/${declaration.kind}.ts`,
                      standard: KIND_STANDARDS[declaration.kind],
                  },
              ]),
        { file: `src/standard/platforms/${platform}.ts`, standard: PLATFORM_STANDARDS[platform] },
        ...Object.entries(DEPENDENCY_STANDARDS)
            .filter(
                ([dependency, { platforms: only }]) =>
                    dependencies.has(dependency) && (only?.includes(platform) ?? true),
            )
            .map(([, { name, standard }]) => ({
                file: `src/standard/dependencies/${name}.ts`,
                standard,
            })),
    ];
}

type StandardOrigin = { file: string; standard: Standard };

function sourcesOf(settings: Readonly<Record<string, unknown>>): NonNullable<Preset['sources']> {
    const { extensions, roots } = objectOf(settings.sources);

    return { extensions: stringsOf(extensions), roots: stringsOf(roots) };
}

/** The toolchain's own preset: its standard, merged for the project's kind, platform and declared dependencies. */
export function typescriptPreset(
    declaration: null | ProjectIdentity,
    dependencies: ReadonlySet<string> = new Set(),
): Preset {
    const standards = standardsOf(declaration, dependencies);
    const origins = standards.map(({ file, standard }) => ({
        file,
        laws: [...(standard.laws?.layers ?? []), ...(standard.laws?.names ?? [])].map(
            ({ name }) => name,
        ),
        settings: objectOf(standard.typescript),
    }));
    let merged: unknown = {};
    for (const origin of origins) {
        merged = mergeSettings(merged, origin.settings).value;
    }
    const settings = objectOf(merged);

    return {
        files: editorFilesOf(settings.tsconfigPreset),
        lawSettings: [
            'lint',
            'manifestKeys',
            'memberRoots',
            'sources',
            'spine',
            'toolRoots',
            'tsconfigPreset',
            'verbatimToolRoots',
            'words',
        ],
        layers: standards.flatMap(({ standard }) => standard.laws?.layers ?? []),
        names: standards.flatMap(({ standard }) => standard.laws?.names ?? []),
        name: 'typescript',
        origins,
        package: '@jterrazz/typescript',
        settings,
        baseline: [BASELINE_SECTION],
        derive: (unit) => (laidOutHexagonally(unit) ? { architecture: { hexagonal: true } } : {}),
        sources: sourcesOf(settings),
        writableSettings: [
            'architecture',
            'knip',
            'mutation',
            'names',
            'oxfmt',
            'oxlint',
            'platforms',
            'roots',
            'tsconfig',
        ],
    };
}

export const basePresetsOf: BasePresets = (declaration, dependencies) => [
    typescriptPreset(declaration, dependencies),
];
