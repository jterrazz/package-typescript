import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { manifestGap } from '../../consumer/checks/config.manifest.js';
import { markdownTable } from '../../kit/catalogue/table.js';
import { CODE_KINDS, PLATFORMS_OF, PUBLICATION } from '../../kit/project/project-kind.js';
import type { CodeKind } from '../../kit/project/project-kind.js';

type Specimen = { gestures: string[]; platforms: string[] };

const DECLARED_KIND = /\bkind:\s*'(?<kind>[a-z]+)'/u;

const DECLARED_PLATFORM = /\bplatform:\s*'(?<platform>[a-z]+)'/gu;

const GESTURES = /\.exec\(\s*\[(?<list>[^\]]*)\]/u;

const QUOTED = /'(?<gesture>[^']+)'/gu;

function settingsUnder(folder: string): string[] {
    if (!existsSync(folder)) {
        return [];
    }

    return readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name === 'jterrazz.config.ts')
        .filter((entry) => !entry.parentPath.includes('node_modules'))
        .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'));
}

function specimenOf(kinds: string, kind: CodeKind): null | Specimen {
    const spec = join(kinds, kind, `${kind}.spec.ts`);
    const fixtures = join(kinds, kind, '__fixtures__');
    const project = join(fixtures, kind);
    const platformed = existsSync(fixtures)
        ? readdirSync(fixtures, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${kind}-`))
              .map((entry) => join(fixtures, entry.name))
              .toSorted()
        : [];
    const settings = [project, ...platformed].flatMap((folder) => settingsUnder(folder));
    const root = existsSync(join(project, 'jterrazz.config.ts'))
        ? readFileSync(join(project, 'jterrazz.config.ts'), 'utf8')
        : '';
    if (!existsSync(spec) || DECLARED_KIND.exec(root)?.groups?.kind !== kind) {
        return null;
    }
    const list = GESTURES.exec(readFileSync(spec, 'utf8'))?.groups?.list ?? '';

    return {
        gestures: [...list.matchAll(QUOTED)].map((match) => match.groups?.gesture ?? ''),
        platforms: [
            ...new Set(
                settings.flatMap((text) =>
                    [...text.matchAll(DECLARED_PLATFORM)].map(
                        (match) => match.groups?.platform ?? '',
                    ),
                ),
            ),
        ],
    };
}

const coded = (values: readonly string[]): string =>
    values.length === 0 ? 'none' : values.map((value) => `\`${value}\``).join(', ');

function cellsOf(kind: CodeKind, specimen: null | Specimen): string[] {
    const gap = manifestGap(kind, {});

    return [
        `\`${kind}\``,
        coded(PLATFORMS_OF[kind]),
        PUBLICATION[kind] === 'published' ? 'published, unless `private`' : PUBLICATION[kind],
        gap === null ? '' : gap.owes,
        PUBLICATION[kind] === 'published' ? 'judged, unless `private`' : 'not judged',
        specimen === null ? 'none' : `\`specs/kinds/${kind}/\` on ${coded(specimen.platforms)}`,
        specimen === null ? 'none' : coded(specimen.gestures),
    ];
}

export function kindMatrix(kinds: string): { refused: string[]; table: string } {
    const specimens = CODE_KINDS.map((kind) => [kind, specimenOf(kinds, kind)] as const);
    const stray = existsSync(kinds)
        ? readdirSync(kinds, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
              .map((entry) => entry.name)
              .filter((name) => !new Set<string>(CODE_KINDS).has(name))
        : [];

    return {
        refused: [
            ...specimens
                .filter(([, specimen]) => specimen === null)
                .map(([kind]) => `${kind}: no specimen declaring it`),
            ...specimens.flatMap(([kind, specimen]) =>
                PLATFORMS_OF[kind]
                    .filter(
                        (platform) => specimen !== null && !specimen.platforms.includes(platform),
                    )
                    .map((platform) => `${kind}: no specimen on ${platform}`),
            ),
            ...stray.map((name) => `${name}: a specimen of no declared kind`),
        ],
        table: markdownTable(
            [
                'Kind',
                'Platforms',
                'Publication',
                'Config refuses a manifest that',
                'Publish pass',
                'Specimen',
                'Gestures it proves',
            ],
            specimens.map(([kind, specimen]) => cellsOf(kind, specimen)),
        ),
    };
}
