import { readSettings } from '../../../lint/index.rules.js';
import { objectOf } from '../../../lint/kit/project/json.js';
import type { Resolution } from '../../../lint/kit/project/preset.js';
import type { MutationScope } from './scope.js';

export const extensionGlob = (extensions: readonly string[]): string =>
    extensions.length === 1 ? (extensions[0] ?? 'ts') : `{${extensions.join(',')}}`;

export const prefixOf = (unit: string): string => (unit === '.' ? '' : `${unit}/`);

export function sourceGlobsOf(unit: string, { resolved }: Resolution): string[] {
    return resolved.presets.flatMap(({ sources }) =>
        sources === undefined
            ? []
            : sources.roots.map(
                  (root) => `${prefixOf(unit)}${root}/**/*.${extensionGlob(sources.extensions)}`,
              ),
    );
}

// invariant: a unit's `typescript.mutation` globs are its standard's and its settings file's, read from the repository root; a presentation file is glue whose pinned text no run mutates.
export function declaredOf(
    unit: string,
    { resolved }: Resolution,
): Omit<MutationScope, 'glue'> & { glue: string[] } {
    const declared = objectOf(objectOf(resolved.sections.typescript).mutation);
    const globs = (key: string): string[] =>
        Object.keys(objectOf(declared[key])).map((glob) => `${prefixOf(unit)}${glob}`);

    return {
        exclude: globs('exclude'),
        glue: globs('glue'),
        ignore: globs('ignore'),
        mutated: globs('mutate'),
        presentation: globs('presentation'),
    };
}

const lawsOf = ({ resolved }: Resolution): { bar: number; cap: number } => {
    const { bar, cap } = objectOf(objectOf(resolved.sections.typescript).mutationGlue);

    return { bar: Number(bar), cap: Number(cap) };
};

export async function mutationScopeOf(project: string): Promise<MutationScope> {
    const settings = await readSettings(project);
    const units = [['.', settings] satisfies [string, Resolution]];
    const declared = units.map(([unit, resolution]) => declaredOf(unit, resolution));

    return {
        exclude: declared.flatMap(({ exclude }) => exclude),
        glue: {
            ...lawsOf(settings),
            globs: declared.flatMap(({ glue, presentation }) => [...glue, ...presentation]),
        },
        ignore: declared.flatMap(({ ignore }) => ignore),
        mutated: [
            ...new Set([
                ...units.flatMap(([unit, resolution]) => sourceGlobsOf(unit, resolution)),
                ...declared.flatMap(({ mutated }) => mutated),
            ]),
        ],
        presentation: declared.flatMap(({ presentation }) => presentation),
    };
}
