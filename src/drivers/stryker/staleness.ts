import { isList, objectOf, stringOf } from '../../../lint/kit/project/json.js';
import { isUnder, roleOf } from './inputs.js';
import type { Reach, Role } from './inputs.js';
import type { Ran } from './observed.js';

type Mutant = Record<string, unknown>;

const idsOf = (mutant: Mutant, key: 'coveredBy' | 'killedBy'): string[] => {
    const ids = mutant[key];

    return isList(ids) ? ids.map(String) : [];
};

type ReportTest = { file: string; key: string };

function testsOf(report: Record<string, unknown>): Map<string, ReportTest> {
    const tests = new Map<string, ReportTest>();
    for (const [file, entry] of Object.entries(objectOf(report.testFiles))) {
        const listed = objectOf(entry).tests;
        for (const test of isList(listed) ? listed : []) {
            const { id, name } = objectOf(test);
            tests.set(String(id), { file, key: `${file}#${stringOf(name) ?? ''}` });
        }
    }

    return tests;
}

type Change = {
    everything: boolean;
    grounds: readonly string[];
    sources: ReadonlySet<string>;
    tests: ReadonlySet<string>;
};

// Stryker disable next-line ConditionalExpression: a role other than ground holds no root, and no test stands under an undefined folder
const isGround = (role: Role): role is Extract<Role, { kind: 'ground' }> => role.kind === 'ground';

function changeOf(changed: readonly string[]): Change {
    const roles = changed.map((path) => ({ path, role: roleOf(path) }));
    const pathsOf = (kind: Role['kind']): Set<string> =>
        new Set(roles.filter(({ role }) => role.kind === kind).map(({ path }) => path));

    return {
        everything: roles.some(({ role }) => role.kind === 'everything'),
        // Stryker disable next-line MethodExpression: a role other than ground holds no root, and no test stands under an undefined folder
        grounds: roles
            .map(({ role }) => role)
            .filter(isGround)
            .map(({ root }) => root),
        sources: pathsOf('source'),
        tests: pathsOf('test'),
    };
}

/** How a run reads a test's reach: the modules its own process loads, what the processes it spawned ran and loaded, and whether a changed source changed only what its functions do. */
export type Staleness = {
    onlyFunctions: (source: string) => boolean;
    ranBy: (test: string) => Ran | undefined;
    reach: (file: string) => Reach;
};

// invariant: a test is stale when its file changed, when ground under a folder above it changed, when a source its own process loads changed, and when a source changed that a process it spawned ran — or loaded, unless the change reaches only what the source's functions do; a test whose processes the last run could not follow is stale whatever source changed.
function isStale(test: ReportTest, change: Change, staleness: Staleness): boolean {
    if (change.tests.has(test.file) || change.grounds.some((root) => isUnder(test.file, root))) {
        return true;
    }
    if (change.sources.size === 0) {
        return false;
    }
    const loads = staleness.reach(test.file);
    const spawned = staleness.ranBy(test.key);

    return (
        loads.everything ||
        spawned === undefined ||
        [...change.sources].some(
            (source) =>
                loads.files.has(source) ||
                spawned.ran.has(source) ||
                (spawned.loaded.has(source) && !staleness.onlyFunctions(source)),
        )
    );
}

/**
 * The report with every result the change could have moved taken out, so Stryker measures it again: each mutant of a source that changed, and each mutant a stale test covered or killed; `undefined` where a file every test reads changed, so nothing of the report holds.
 * Stryker keys a mutant by the text around it and a test by its own lines, so alone it would keep a kill a changed helper, fixture or setup file has outlived.
 */
export function reportAfter(
    report: Record<string, unknown>,
    changed: readonly string[],
    stale: Staleness,
): Record<string, unknown> | undefined {
    const change = changeOf(changed);
    if (change.everything) {
        return undefined;
    }
    const staleTests = new Set(
        [...testsOf(report)].filter(([, test]) => isStale(test, change, stale)).map(([id]) => id),
    );
    const files: Record<string, unknown> = {};
    for (const [file, entry] of Object.entries(objectOf(report.files))) {
        if (change.sources.has(file)) {
            continue;
        }
        const { mutants } = objectOf(entry);
        files[file] = {
            ...objectOf(entry),
            mutants: (isList(mutants) ? mutants : [])
                .map(objectOf)
                .filter(
                    (mutant) =>
                        ![...idsOf(mutant, 'coveredBy'), ...idsOf(mutant, 'killedBy')].some((id) =>
                            staleTests.has(id),
                        ),
                ),
        };
    }

    return { ...report, files };
}
