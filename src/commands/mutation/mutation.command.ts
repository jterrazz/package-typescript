import { existsSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { clientOnlySources } from '../../../lint/kit/project/browser-side.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { toolchainIn } from '../../drivers/node/node.js';
import { concurrencyOf, jobsNamed } from '../../drivers/stryker/concurrency.js';
import { strykerPrepared, strykerRun } from '../../drivers/stryker/stryker.js';
import type { Measured, Stage } from '../../drivers/stryker/stryker.js';
import { diffStaysInFunctions } from '../../drivers/tsc/change-shape.js';
import { secondsSince } from '../check/passes/launched.js';
import { badge, print, RED, RESET, secondsOf } from '../check/report/terminal.js';
import { activeGates, withGateLock } from '../gate-lock/lock.js';
import { askedOf } from './asked.js';
import { baseFor, changeOf, namesACommit, treeChangeFor } from './change.js';
import type { Base } from './change.js';
import { memberRuns, unownedRange } from './members.js';
import { concluded, judgedRecorded, memberRecorded, recorder, stageRecorded } from './recorded.js';
import type { Recorded } from './recorded.js';
import type { GlueBar } from './roles.js';
import { mutationScopeOf } from './scope-globs.js';
import { changedRanges, modulesMutated, sourcesOf, unreachedRange } from './scope.js';
import type { MutationScope } from './scope.js';
import { afterStage, buildsOf, withClientOnlyUnmeasured } from './stages.js';
import { handedToTheSuite, judgedRuns } from './survivors.js';
import type { Changed, Judged, ModuleRun } from './survivors.js';
import { measureOf, verdictOf } from './verdict.js';
import type { Measure } from './verdict.js';

type Run = { cold: boolean; jobs: number | undefined; project: string; recorded: Recorded };

const sourceIn =
    (project: string) =>
    (file: string): string =>
        String(readFileSync(join(project, file)));

async function measured(
    scope: MutationScope,
    stage: Stage,
    { cold, jobs, project, recorded }: Run,
): Promise<Measured | { status: number }> {
    print(
        `${badge('TYPESCRIPT')} ${stage.name === 'suite' ? 'Measuring the whole suite against what the module tests let live, and the changed lines they do not run' : 'Measuring the module tests against mutants of the sources they test'}...\n\n`,
    );

    const from = performance.now();
    const concurrency = concurrencyOf(stage.name, {
        cores: availableParallelism(),
        gates: activeGates(),
        jobs,
    });
    const outcome = await strykerRun(scope, stage, {
        buildsFirst: buildsOf(project),
        cold,
        concurrency,
        project,
        staysInFunctions: diffStaysInFunctions,
    });
    const seconds = secondsSince(from);
    print(
        `${badge('TYPESCRIPT')} ${stage.name === 'suite' ? 'The whole suite' : 'The module tests'} ran in ${secondsOf(seconds)} on ${String(concurrency)} test runner(s)\n`,
    );
    stageRecorded(recorded, stage.name, {
        seconds,
        status: 'status' in outcome ? outcome.status : 0,
    });

    return withClientOnlyUnmeasured(outcome, clientOnlySources(project));
}

function printed(
    judged: Judged,
    {
        glue,
        measure,
        recorded,
        untestedSources,
    }: { glue: GlueBar; measure: Measure; recorded: Recorded; untestedSources: number },
): number {
    judgedRecorded(recorded, judged, { glue, measure });
    const verdict = verdictOf(judged, untestedSources, { glue, measure });
    print(`\n${verdict.lines.join('\n')}\n`);

    return verdict.status;
}

type Change = { changed: Changed; ranges: readonly string[] | undefined; since: Base };

async function judgedAfterTheSuite({
    change: { changed, ranges, since },
    modulesRun,
    run,
    scope,
    untested,
}: {
    change: Change;
    modulesRun: ModuleRun;
    run: Run;
    scope: MutationScope;
    untested: readonly string[];
}): Promise<number> {
    const { project, recorded } = run;
    const modulesAlone = judgedRuns(modulesRun);
    const measure = measureOf(since);
    const verdictOver = { glue: scope.glue, measure, recorded, untestedSources: untested.length };
    // Stryker disable next-line ConditionalExpression: a mutant the run never judged fails the verdict whether or not the suite runs after it; the gate only spares the suite's minutes
    if (Object.keys(modulesAlone.unrun).length > 0) {
        return printed(modulesAlone, verdictOver);
    }
    const reached = changedRanges(untested, changed, sourceIn(project));
    // invariant: `--mutate` names the lines to measure and the default run's policy for a static mutant stands: the module tests leave it to the suite only where the tree's own change reaches it.
    const statics = treeChangeFor(project, { ranges, since }, changed);
    const reach = { changed, statics };
    const handed = [...reached, ...handedToTheSuite(modulesRun, reach)];
    if (handed.length === 0) {
        return printed(modulesAlone, verdictOver);
    }
    return await afterStage(
        await measured(scope, { mutate: handed, name: 'suite' }, run),
        ({ report }) =>
            printed(judgedRuns(modulesRun, { ...reach, report, untested: reached }), verdictOver),
    );
}

function refusedRange(range: string, where: string, recorded: Recorded): number {
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

// invariant: a workspace root keeps no vitest config: each member is measured in its own folder, as `cd <member> && typescript mutation` measures it, into its own `.artifacts/stryker/`.
async function membersMeasured(
    project: string,
    members: readonly string[],
    asked: {
        cold: boolean;
        ranges: readonly string[] | undefined;
        since: string | undefined;
    },
    recorded: Recorded,
): Promise<number> {
    const unowned = unownedRange(members, asked.ranges ?? []);
    if (unowned !== undefined) {
        return refusedRange(unowned, 'a source of a member of the workspace', recorded);
    }
    let status = 0;
    for (const { args, member } of memberRuns(members, asked)) {
        print(`${badge('TYPESCRIPT')} ${member}\n\n`);
        const from = performance.now();
        const own = await toolchainIn(join(project, member), ['mutation', ...args]);
        memberRecorded(recorded, project, { member, seconds: secondsSince(from), status: own });
        status = Math.max(status, own);
    }

    return status;
}

function refusedSince(named: string, recorded: Recorded): number {
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
function measuredNothing(project: string, recorded: Recorded): number {
    const why = `${project} holds no module test and no specs/, so no test project to run a mutant against`;
    recorded.reason = `measured nothing: ${why}`;
    print(`${badge('TYPESCRIPT')} measured nothing: ${why}.\n`);

    return 0;
}

async function measuredRun(
    project: string,
    args: readonly string[],
    { jobs, recorded }: { jobs: number | undefined; recorded: Recorded },
): Promise<number> {
    const { cold, named, ranges } = askedOf(args);
    const run: Run = { cold, jobs, project, recorded };
    if (named !== undefined && !namesACommit(project, named)) {
        return refusedSince(named, recorded);
    }
    const members = workspaceMembers(project);
    if (members.length > 0) {
        return await membersMeasured(project, members, { cold, ranges, since: named }, recorded);
    }
    const since = baseFor(project, named);
    const scope = await mutationScopeOf(project);
    const { tested, untested } = sourcesOf(project, scope);
    if (tested.length === 0 && !existsSync(join(project, 'specs'))) {
        return measuredNothing(project, recorded);
    }
    const unreached = unreachedRange(ranges ?? [], new Set([...tested, ...untested]));
    if (unreached !== undefined) {
        return refusedRange(unreached, 'a source the run mutates', recorded);
    }
    strykerPrepared(project, scope.presentation);

    const { changed, known, note } = changeOf(project, { ranges, since });
    if (note !== undefined) {
        print(`${badge('TYPESCRIPT')} ${note}\n`);
    }
    const modules = modulesMutated(tested, { changed, known, ranges }, sourceIn(project));
    const first =
        modules.length === 0
            ? undefined
            : await measured(scope, { mutate: modules, name: 'modules' }, run);

    return await afterStage(
        first,
        async ({ ranByTests, report }) =>
            await judgedAfterTheSuite({
                change: { changed, ranges, since },
                modulesRun: { measured: modules, ranByTests, report },
                run,
                scope,
                untested,
            }),
    );
}

function refusedJobs(named: string, recorded: Recorded): number {
    const found = `TYPESCRIPT_JOBS is ${named}, which counts no test runner`;
    recorded.reason = `refused before any run: ${found}`;
    print(
        `${RED}${refusal({
            fix: "set it to a positive integer (TYPESCRIPT_JOBS=2), or leave it unset to take this gate's share of the cores",
            found,
            read: 'docs/reference/quality-checks.md#how-many-test-runners',
            why: 'a count Stryker cannot run would stop the run, or run another one than the one asked for',
        })}${RESET}\n`,
    );

    return 1;
}

export async function mutation(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const recorded = recorder();
    const named = process.env.TYPESCRIPT_JOBS;
    const jobs = jobsNamed(named);

    return await withGateLock(project, async () =>
        concluded(
            project,
            recorded,
            Number.isNaN(jobs)
                ? refusedJobs(String(named), recorded)
                : await measuredRun(project, args, { jobs, recorded }),
        ),
    );
}
