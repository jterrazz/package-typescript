import { MUTATION_OUTPUT } from './build-plan.js';
import { isList, objectOf, stringOf } from './json.js';
import type { JsonObject } from './json.js';

/** The two runs of a mutation command, each with the report it writes. */
export type StageName = 'modules' | 'suite';

export const REPORT_NAMES: Readonly<Record<StageName, string>> = {
    modules: 'report',
    suite: 'suite-report',
};

/** Where a stage writes its JSON report, from the project's root. */
export const reportPathOf = (stage: StageName): string =>
    `${MUTATION_OUTPUT}/${REPORT_NAMES[stage]}.json`;

/** A mutant as a Stryker report holds it. */
export type ReportMutant = JsonObject;

const listedMutants = (entry: unknown): ReportMutant[] => {
    const { mutants } = objectOf(entry);

    return isList(mutants) ? mutants.map((one) => objectOf(one)) : [];
};

/** Every mutant of a report, each beside the file it sits in. */
export const mutantsOf = (report: unknown): [string, ReportMutant][] =>
    Object.entries(objectOf(objectOf(report).files)).flatMap(([file, entry]) =>
        listedMutants(entry).map((mutant): [string, ReportMutant] => [file, mutant]),
    );

/** The report with each file's mutants as `edit` returns them: `undefined` drops the file, and the list it was handed keeps the file's entry as the report held it. */
export function reportEdited(
    report: unknown,
    edit: (file: string, mutants: ReportMutant[]) => ReportMutant[] | undefined,
): Record<string, unknown> {
    const files = Object.entries(objectOf(objectOf(report).files)).flatMap(
        ([file, entry]): [string, unknown][] => {
            const mutants = listedMutants(entry);
            const edited = edit(file, mutants);
            if (edited === undefined) {
                return [];
            }

            return [[file, edited === mutants ? entry : { ...objectOf(entry), mutants: edited }]];
        },
    );

    return { ...objectOf(report), files: Object.fromEntries(files) };
}

/** A test as a run names it: its file, and its key, the file and its name joined by `#`. */
export type ReportTest = { file: string; key: string };

/** What joins a test's file and its name in its key, as Stryker's vitest runner names a test. */
export const TEST_KEY_JOIN = '#';

/** The key a run names a test by: its file and its name, joined. */
export const testKeyOf = (file: string, name: string): string => `${file}${TEST_KEY_JOIN}${name}`;

/** The file of the test a key names. */
export const testFileOf = (key: string): string => key.split(TEST_KEY_JOIN)[0] ?? key;

/** Every test a report lists, by its id. */
export function testsOf(report: unknown): Map<string, ReportTest> {
    const tests = new Map<string, ReportTest>();
    for (const [file, entry] of Object.entries(objectOf(objectOf(report).testFiles))) {
        const listed = objectOf(entry).tests;
        for (const test of isList(listed) ? listed : []) {
            const { id, name } = objectOf(test);
            tests.set(String(id), { file, key: testKeyOf(file, stringOf(name) ?? '') });
        }
    }

    return tests;
}
