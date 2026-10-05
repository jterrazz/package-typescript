import API from '../../../src/standard/kinds/api.js';
import CLI from '../../../src/standard/kinds/cli.js';
import LIBRARY from '../../../src/standard/kinds/library.js';
import MOBILE from '../../../src/standard/kinds/mobile.js';
import WEBSITE from '../../../src/standard/kinds/website.js';
import WORKSPACE from '../../../src/standard/kinds/workspace.js';
import ASTRO from '../../../src/standard/platforms/astro.js';
import BUN from '../../../src/standard/platforms/bun.js';
import EXPO from '../../../src/standard/platforms/expo.js';
import NEXT from '../../../src/standard/platforms/next.js';
import NODE from '../../../src/standard/platforms/node.js';
import REACT from '../../../src/standard/platforms/react.js';
import STANDARD from '../../../src/standard/standard.js';
import type { Standard } from '../../index.config.js';
import { OXFMT_CONFIG, OXLINT_CONFIG } from '../../kit/project/editor-config-names.js';
import type { EditorFile } from '../../kit/project/editor-files.js';
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
    workspace: WORKSPACE,
};

const PLATFORM_STANDARDS: Readonly<Record<Platform, Standard>> = {
    astro: ASTRO,
    bun: BUN,
    expo: EXPO,
    next: NEXT,
    node: NODE,
    react: REACT,
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

// invariant: the merge order of the standard: the package's, then the kind's, then the platform's — a workspace and an undeclared project read the node platform's.
function standardsOf(declaration: null | ProjectIdentity): StandardOrigin[] {
    const platform = declaration?.platform ?? 'node';

    return [
        { file: 'src/standard/standard.ts', standard: STANDARD },
        ...(declaration === null
            ? []
            : [
                  {
                      file: `src/standard/kinds/${declaration.kind}.ts`,
                      standard: KIND_STANDARDS[declaration.kind],
                  },
              ]),
        { file: `src/standard/platforms/${platform}.ts`, standard: PLATFORM_STANDARDS[platform] },
    ];
}

type StandardOrigin = { file: string; standard: Standard };

function sourcesOf(settings: Readonly<Record<string, unknown>>): NonNullable<Preset['sources']> {
    const { extensions, roots } = objectOf(settings.sources);

    return { extensions: stringsOf(extensions), roots: stringsOf(roots) };
}

/** The toolchain's own preset: its standard, merged for the project's kind and platform. */
export function typescriptPreset(declaration: null | ProjectIdentity): Preset {
    const standards = standardsOf(declaration);
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
            'memberRoots',
            'sources',
            'spine',
            'toolRoots',
            'tsconfigPreset',
            'words',
        ],
        layers: standards.flatMap(({ standard }) => standard.laws?.layers ?? []),
        names: standards.flatMap(({ standard }) => standard.laws?.names ?? []),
        name: 'typescript',
        origins,
        package: '@jterrazz/typescript',
        settings,
        baseline: [BASELINE_SECTION],
        sources: sourcesOf(settings),
    };
}

export const basePresetsOf: BasePresets = (declaration) => [typescriptPreset(declaration)];
