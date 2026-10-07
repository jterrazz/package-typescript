import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { manifestGap } from '../../consumer/checks/config.manifest.js';
import { markdownTable } from '../../kit/catalogue/table.js';
import { KINDS, PLATFORMS_OF, PUBLICATION } from '../../kit/project/project-kind.js';
import type { ProjectKind } from '../../kit/project/project-kind.js';

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

function specimenOf(kinds: string, kind: ProjectKind): null | Specimen {
    const spec = join(kinds, kind, `${kind}.spec.ts`);
    const project = join(kinds, kind, '__fixtures__', kind);
    const settings = settingsUnder(project);
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
    values.length === 0 ? '—' : values.map((value) => `\`${value}\``).join(', ');

function cellsOf(kind: ProjectKind, specimen: null | Specimen): string[] {
    const gap = manifestGap(kind, {});

    return [
        `\`${kind}\``,
        kind === 'workspace' ? 'none — each member its own' : coded(PLATFORMS_OF[kind]),
        PUBLICATION[kind] === 'published' ? 'published, unless `private`' : PUBLICATION[kind],
        gap === null ? '—' : gap.owes,
        PUBLICATION[kind] === 'published' ? 'judged, unless `private`' : '—',
        specimen === null ? 'none' : `\`specs/kinds/${kind}/\` on ${coded(specimen.platforms)}`,
        specimen === null ? '—' : coded(specimen.gestures),
    ];
}

export function kindMatrix(kinds: string): { refused: string[]; table: string } {
    const specimens = KINDS.map((kind) => [kind, specimenOf(kinds, kind)] as const);
    const stray = existsSync(kinds)
        ? readdirSync(kinds, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
              .map((entry) => entry.name)
              .filter((name) => !new Set<string>(KINDS).has(name))
        : [];

    return {
        refused: [
            ...specimens
                .filter(([, specimen]) => specimen === null)
                .map(([kind]) => `${kind}: no specimen declaring it`),
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
