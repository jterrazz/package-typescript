import { isList, objectOf } from '../../../lint/kit/project/json.js';
import type { Inputs } from './inputs.js';

/** What a test's processes did in the last dry run: the sources whose functions they ran, and the sources of every script they loaded. */
export type Ran = { loaded: ReadonlySet<string>; ran: ReadonlySet<string> };

/** One test as the dry run saw it, by its key; a test with neither list is one the run could not follow into every process it spawned. */
export type ObservedTest = { loaded?: readonly string[]; ran?: readonly string[]; test: string };

/** The tests of the last dry run, each set of sources written once: a test names the set its processes ran and the set they loaded. */
export type Observed = {
    sets: readonly (readonly string[])[];
    tests: Readonly<Record<string, readonly [number, number]>>;
};

/** The observed tests, each list of sources written once however many tests share it; a test whose processes ran a file the inputs do not hold — a build with no map back to its sources — is one the run could not follow. */
export function observedFrom(records: readonly ObservedTest[], inputs?: Inputs): Observed {
    const sets: string[][] = [];
    const indexOf = new Map<string, number>();
    const setOf = (sources: readonly string[]): number => {
        const key = JSON.stringify(sources);
        const held = indexOf.get(key);
        if (held !== undefined) {
            return held;
        }
        sets.push([...sources]);
        indexOf.set(key, sets.length - 1);

        return sets.length - 1;
    };
    const tests: Record<string, readonly [number, number]> = {};
    const known = (sources: readonly string[]): boolean =>
        inputs === undefined || sources.every((source) => inputs[source] !== undefined);
    for (const { loaded, ran, test } of records) {
        if (loaded !== undefined && ran !== undefined && known(loaded) && known(ran)) {
            tests[test] = [setOf(ran), setOf(loaded)];
        }
    }

    return { sets, tests };
}

/** What the record says a test's processes ran, or `undefined` where it cannot say. */
export function ranBy(observed: Observed | undefined): (test: string) => Ran | undefined {
    const sets = (observed?.sets ?? []).map((sources) => new Set(sources));

    return (test) => {
        const [ran, loaded] = observed?.tests[test] ?? [];
        const ranSet = ran === undefined ? undefined : sets[ran];
        const loadedSet = loaded === undefined ? undefined : sets[loaded];

        return ranSet === undefined || loadedSet === undefined
            ? undefined
            : { loaded: loadedSet, ran: ranSet };
    };
}

const numbersOf = (value: unknown): number[] => (isList(value) ? value.map(Number) : []);

// invariant: on disk every source is named once, in `names`, and a set lists its indices there — the sets of a large suite name the same few hundred sources thousands of times.
export function observedOf(value: unknown): Observed | undefined {
    if (value === undefined) {
        return undefined;
    }
    const { names, sets, tests } = objectOf(value);
    const named = isList(names) ? names.map(String) : [];

    return {
        sets: (isList(sets) ? sets : []).map((one) =>
            numbersOf(one).map((index) => named[index] ?? ''),
        ),
        tests: Object.fromEntries(
            Object.entries(objectOf(tests)).map(([test, pair]) => {
                const [ran = -1, loaded = -1] = numbersOf(pair);

                return [test, [ran, loaded] as const];
            }),
        ),
    };
}

export function observedOnDisk({ sets, tests }: Observed): object {
    const names = [...new Set(sets.flat())].toSorted();
    const indexOf = new Map(names.map((name, index) => [name, index]));

    return {
        names,
        sets: sets.map((one) => one.map((name) => indexOf.get(name))),
        tests,
    };
}
