const recordOf = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A mutant of a Stryker report as a spec compares it: what it covered, by test name, how it ended, and how many tests it ran. */
export type ReportedMutant = { coveredBy: string[]; status: string; testsCompleted: number };

/** Every mutant of a Stryker report, by its place, its mutator and its replacement, each test it names read by its name, since a run numbers its tests in the order its dry run met them. */
export function reportedMutants(content: string): Record<string, ReportedMutant> {
    const report = recordOf(JSON.parse(content));
    const names = new Map(
        Object.values(recordOf(report.testFiles)).flatMap((file) =>
            listOf(recordOf(file).tests).map((test) => {
                const { id, name } = recordOf(test);

                return [String(id), String(name)] as const;
            }),
        ),
    );

    return Object.fromEntries(
        Object.entries(recordOf(report.files)).flatMap(([file, entry]) =>
            listOf(recordOf(entry).mutants).map((value) => {
                const mutant = recordOf(value);
                const { column, line } = recordOf(recordOf(mutant.location).start);

                return [
                    `${file}:${String(line)}:${String(column)} ${String(mutant.mutatorName)} ${String(mutant.replacement)}`,
                    {
                        coveredBy: listOf(mutant.coveredBy)
                            .map((id) => names.get(String(id)) ?? String(id))
                            .toSorted(),
                        status: String(mutant.status),
                        testsCompleted: Number(mutant.testsCompleted ?? 0),
                    },
                ] as const;
            }),
        ),
    );
}
