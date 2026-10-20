import type { Instrumenter } from '@stryker-mutator/instrumenter';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { objectOf } from '../../../lint/kit/project/json.js';

type Ignorer = Parameters<Instrumenter['instrument']>[1]['ignorers'][number];

const isIgnorer = (value: unknown): value is Ignorer =>
    typeof objectOf(value).shouldIgnore === 'function';

/** A mutant as made before any run: its place as a report counts it (from 1), the end of the node it mutates, its mutator and its replacement. */
export type Made = {
    column: number;
    endColumn: number;
    endLine: number;
    file: string;
    line: number;
    mutator: string;
    replacement: string;
};

// outside: Stryker's instrumenter counts a mutant's lines and columns from 0, where its report counts both from 1.
const placeOf = (location: unknown): [number, number] => {
    const { column, line } = objectOf(location);

    return [Number(line) + 1, Number(column) + 1];
};

/** Every mutant Stryker makes of the files, through the ignorers the run laid, before any run: what a directive or an ignorer sets aside is not made. */
export async function mutantsMade(
    project: string,
    files: readonly string[],
    ignorersFile: string,
): Promise<Made[]> {
    // outside: Stryker's packages load only where a mutation run needs them, so every other command starts without them.
    const instrumenter = await import('@stryker-mutator/instrumenter');
    const { noopLogger } = await import('@stryker-mutator/util');
    const laid: unknown = await import(pathToFileURL(join(project, ignorersFile)).href);
    const { strykerPlugins } = objectOf(laid);
    const ignorers = [strykerPlugins]
        .flat()
        .map((plugin) => objectOf(plugin).value)
        .filter((value) => isIgnorer(value));
    const { mutants } = await new instrumenter.Instrumenter(noopLogger).instrument(
        files.map((file) => ({
            content: readFileSync(join(project, file), 'utf8'),
            mutate: true,
            name: join(project, file),
        })),
        { excludedMutations: [], ignorers, noHeader: true, plugins: null },
    );

    return mutants
        .filter(({ status }) => status !== 'Ignored')
        .map(({ fileName, location, mutatorName, replacement }) => {
            const [line, column] = placeOf(location.start);
            const [endLine, endColumn] = placeOf(location.end);

            return {
                column,
                endColumn,
                endLine,
                file: fileName.slice(project.length + 1),
                line,
                mutator: mutatorName,
                replacement,
            };
        });
}
