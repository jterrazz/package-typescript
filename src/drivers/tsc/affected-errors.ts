import type { Diagnostic } from '@typescript/native/sync';

/** What a mutated file reaches: the files that import each file, and the files whose change reaches every file, a script or a module that augments another. */
export type ImportGraph = {
    global: ReadonlySet<string>;
    importers: ReadonlyMap<string, ReadonlySet<string>>;
};

/** What a mutated program asks of the checker: the errors of some of its files, every file's, and how a file looks to its importers. */
export type Mutated = {
    errors: (files?: readonly string[]) => readonly Diagnostic[];
    shape: (file: string) => string | undefined;
};

// invariant: an importer is checked again only where a file it imports changed how it looks from outside, as TypeScript's builder decides which files a change affects; the unmutated tree holds no error, so an error is the mutant's wherever it appears.
/** The errors a mutant of `file` causes: the file's own, then those of each importer of a file whose shape it changed, every file's where no import bounds the change. */
export function affectedErrors(
    graph: ImportGraph,
    file: string,
    { errors, shape }: Mutated,
    baseShape: (file: string) => string | undefined,
): readonly Diagnostic[] {
    if (graph.global.has(file)) {
        return errors();
    }
    const own = errors([file]);
    if (own.length > 0) {
        return own;
    }
    const seen = new Set([file]);
    const changed = [file];
    for (let next = changed.shift(); next !== undefined; next = changed.shift()) {
        const now = shape(next);
        if (now !== undefined && now === baseShape(next)) {
            continue;
        }
        // Stryker disable next-line ArrayDeclaration: every file the walk reaches is a key of the graph, which lists the importers of each file it holds, so no file is missing from it
        const importers = [...(graph.importers.get(next) ?? [])].filter(
            (importer) => !seen.has(importer),
        );
        const found = importers.length === 0 ? [] : errors(importers);
        if (found.length > 0) {
            return found;
        }
        for (const importer of importers) {
            seen.add(importer);
            changed.push(importer);
        }
    }

    return [];
}
