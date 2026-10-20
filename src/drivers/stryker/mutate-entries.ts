import { isList, objectOf } from '../../../lint/kit/project/json.js';

const ENTRY =
    // Stryker disable next-line Regex: the pattern matches every string from its first character, so anchoring its start changes nothing an entry could show
    /^(?<file>.*?)(?::(?<fromLine>\d+)(?::(?<fromColumn>\d+))?-(?<toLine>\d+)(?::(?<toColumn>\d+))?)?$/su;

type Point = readonly [line: number, column: number];

type Entry = { file: string; range: undefined | { from: Point; to: Point }; text: string };

function entryOf(text: string): Entry {
    // Stryker disable next-line OptionalChaining: the pattern matches every string, so its groups are always there
    const { file = text, fromColumn, fromLine, toColumn, toLine } = ENTRY.exec(text)?.groups ?? {};

    return {
        file,
        range:
            fromLine === undefined
                ? undefined
                : {
                      from: [Number(fromLine), Number(fromColumn ?? 0)],
                      to: [Number(toLine), Number(toColumn ?? Number.MAX_SAFE_INTEGER)],
                  },
        text,
    };
}

// invariant: braces around a comma are expanded whatever escapes them, so such a file reaches Stryker whole, through `?` in place of each comma, and the report is cut back to the ranges asked.
const isWidened = (file: string): boolean => file.includes('{') && file.includes(',');

// outside: Stryker reads a mutate entry as a minimatch glob after turning every backslash into a slash, so a backslash escapes nothing there; a character held in a class of its own is read back as a plain path, which a line range may sit beside.
const literalOf = (file: string): string => {
    const classed = file.replaceAll(/[[\]{}()*?]/gu, '[$&]');

    return isWidened(file) ? classed.replaceAll(',', '?') : classed;
};

/** The entries Stryker is handed for the files and ranges a stage mutates: each path held literal, and a file no glob can name exactly handed whole. */
export function strykerMutate(mutate: readonly string[]): string[] {
    return [
        ...new Set(
            mutate.map((text) => {
                const { file } = entryOf(text);
                const literal = literalOf(file);

                return isWidened(file) ? literal : `${literal}${text.slice(file.length)}`;
            }),
        ),
    ];
}

const atOrBefore = ([line, column]: Point, [otherLine, otherColumn]: Point): boolean =>
    line < otherLine || (line === otherLine && column <= otherColumn);

function pointOf(location: unknown): Point {
    const { column, line } = objectOf(location);

    return [Number(line), Number(column) - 1];
}

/** The files a stage's entries name, as the project holds them, each with the lines its ranges hold, counted from 1: `undefined` where an entry names it whole. */
export function mutatedLines(mutate: readonly string[]): Map<string, number[] | undefined> {
    const lines = new Map<string, number[] | undefined>();
    for (const { file, range } of mutate.map((text) => entryOf(text))) {
        const held = lines.has(file) ? lines.get(file) : [];
        lines.set(
            file,
            range === undefined || held === undefined
                ? undefined
                : [
                      ...held,
                      ...Array.from(
                          { length: range.to[0] - range.from[0] + 1 },
                          (_, at) => range.from[0] + at,
                      ),
                  ],
        );
    }

    return lines;
}

// outside: Stryker mutates in a range what starts and ends within it, its lines counted from 1 and its columns from 0, where a report counts both from 1.
function heldBy(entries: readonly Entry[], mutant: unknown): boolean {
    const { end, start } = objectOf(objectOf(mutant).location);

    return entries.some(
        ({ range }) =>
            range === undefined ||
            (atOrBefore(range.from, pointOf(start)) && atOrBefore(pointOf(end), range.to)),
    );
}

/** Whether the entries a stage is handed hold a mutant of the file at that location, its lines and columns counted from 1 as a report counts them. */
export const heldIn = (mutate: readonly string[], file: string, location: unknown): boolean =>
    heldBy(
        mutate.map((text) => entryOf(text)).filter((entry) => entry.file === file),
        { location },
    );

/** The stage's report as the entries asked it: a file handed whole for want of a glob naming it exactly keeps only what its ranges hold, and a braced file no entry names, which only that glob matched, nothing. */
export function heldReport(report: unknown, mutate: readonly string[]): unknown {
    const entries = mutate.map((text) => entryOf(text));
    if (!entries.some(({ file }) => isWidened(file))) {
        return report;
    }
    const { files } = objectOf(report);
    const held = Object.entries(objectOf(files)).flatMap(([file, entry]): [string, unknown][] => {
        const named = entries.filter((one) => one.file === file);
        if (!file.includes('{')) {
            return [[file, entry]];
        }
        if (named.length === 0) {
            return [];
        }
        const { mutants } = objectOf(entry);

        return [
            [
                file,
                {
                    ...objectOf(entry),
                    mutants: isList(mutants) ? mutants.filter((one) => heldBy(named, one)) : [],
                },
            ],
        ];
    });

    return { ...objectOf(report), files: Object.fromEntries(held) };
}
