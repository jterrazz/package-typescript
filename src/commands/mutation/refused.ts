import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { capacityUnread } from '../../../lint/kit/project/capacity.js';
import { badge, print, RED, RESET } from '../terminal.js';
import type { Recorded } from './recorded.js';

export function refusedRange(range: string, where: string, recorded: Recorded): number {
    const found = `--mutate names ${range}, which reaches no source the run mutates`;
    recorded.reason = `refused before any run: ${found}`;
    print(
        `${RED}${refusal({
            fix: `name ${where}, by its path from the project's root and its lines as from-to (src/a.ts:10-20), or the whole file by its path`,
            found,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'a range that reaches no source narrows both runs to nothing, and the run would pass having measured nothing',
        })}${RESET}\n`,
    );

    return 1;
}

export function refusedSince(named: string, recorded: Recorded): number {
    const found = `git names no commit ${named}`;
    recorded.reason = `refused before any run: ${found}`;
    print(
        `${RED}${refusal({
            fix: 'name a commit this clone holds (fetch it), or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the change not yet committed, or, on a clean tree, the branch since its merge-base with the default branch',
            found,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing',
        })}${RESET}\n`,
    );

    return 1;
}

// invariant: a project with no module test and no `specs/` has nothing to run a mutant against; Stryker would stop on a missing test project, and the run says what it measured instead.
export function measuredNothing(project: string, recorded: Recorded): number {
    const why = `${project} holds no module test and no specs/, so no test project to run a mutant against`;
    recorded.reason = `measured nothing: ${why}`;
    print(`${badge('TYPESCRIPT')} measured nothing: ${why}.\n`);

    return 0;
}

export function refusedCapacity(named: string, recorded: Recorded): number {
    const unread = capacityUnread(named);
    recorded.reason = `refused before any run: ${unread.found}`;
    print(
        `${RED}${refusal({ ...unread, read: 'docs/reference/quality-checks.md#how-many-test-runners' })}${RESET}\n`,
    );

    return 1;
}
