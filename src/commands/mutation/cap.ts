import { createHash } from 'node:crypto';

import { objectOf } from '../../../lint/kit/project/json.js';
import { reportEdited } from '../../../lint/kit/project/mutation-report.js';
import type { Made } from '../../drivers/stryker/enumerate.js';

/** What the cap kept of a change's glue: the mutants it measures, the files they sit in, and how many the change made. */
export type Capped = {
    files: ReadonlySet<string>;
    kept: ReadonlySet<string>;
    measured: Made[];
    of: number;
};

const keyOf = (
    file: string,
    [line, column]: readonly [number, number],
    mutator: string,
    replacement: string,
): string => `${file}:${String(line)}:${String(column)} ${mutator} ${replacement}`;

const madeKey = ({ column, file, line, mutator, replacement }: Made): string =>
    keyOf(file, [line, column], mutator, replacement);

const hashOf = (key: string): string => createHash('sha256').update(key).digest('hex');

// invariant: the glue a change makes beyond the cap is a sample, picked by a hash of each mutant alone, so the same mutants are picked whatever order they were made in, and a cold and an incremental run measure the same ones; history never orders it, since picking by survival would bias the share the bar reads.
export function capped(made: readonly Made[], cap: number): Capped | undefined {
    if (made.length <= cap) {
        return undefined;
    }
    const measured = made
        .map((mutant) => ({ hash: hashOf(madeKey(mutant)), mutant }))
        .toSorted((one, other) => one.hash.localeCompare(other.hash))
        .slice(0, cap)
        .map(({ mutant }) => mutant);

    return {
        files: new Set(made.map(({ file }) => file)),
        kept: new Set(measured.map((mutant) => madeKey(mutant))),
        measured,
        of: made.length,
    };
}

/** The entries a stage is handed once the cap holds: a capped file's own entries give way to one range per mutant kept there, its lines from 1 and its columns from 0, as Stryker reads a range. */
export function cappedEntries(
    entries: readonly string[],
    { files, measured }: Capped,
    fileOf: (entry: string) => string,
): string[] {
    const named = new Set(entries.map((entry) => fileOf(entry)));
    const ranges = measured
        .filter(({ file }) => named.has(file))
        .map(
            ({ column, endColumn, endLine, file, line }) =>
                `${file}:${String(line)}:${String(column - 1)}-${String(endLine)}:${String(endColumn - 1)}`,
        );

    return [...new Set([...entries.filter((entry) => !files.has(fileOf(entry))), ...ranges])];
}

// invariant: a range Stryker is handed holds every mutant whose node starts and ends inside it, so a kept mutant's range brings the mutants nested in its node too; the report keeps only the kept ones of a capped file.
export const cappedReport = (report: unknown, { files, kept }: Capped): unknown =>
    reportEdited(report, (file, mutants) =>
        files.has(file)
            ? mutants.filter(({ location, mutatorName, replacement }) => {
                  const { column, line } = objectOf(objectOf(location).start);

                  return kept.has(
                      keyOf(
                          file,
                          [Number(line), Number(column)],
                          String(mutatorName),
                          String(replacement),
                      ),
                  );
              })
            : mutants,
    );
