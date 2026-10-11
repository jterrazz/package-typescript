import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { toolchainIn } from '../../drivers/node/node.js';
import { strykerPrepared, strykerRun } from '../../drivers/stryker/stryker.js';
import type { Measured, Stage } from '../../drivers/stryker/stryker.js';
import { badge, print, RED, RESET } from '../check/report/terminal.js';
import { askedOf } from './asked.js';
import { changeOf, defaultBaseOf, namesACommit, treeChangeFor } from './change.js';
import type { Base } from './change.js';
import { memberRuns, unownedRange } from './members.js';
import { mutationScopeOf } from './scope-globs.js';
import { changedRanges, fileOf, narrowed, sourcesOf, unreachedRange } from './scope.js';
import type { MutationScope } from './scope.js';
import { afterStage, buildsOf } from './stages.js';
import { handedToTheSuite, judgedRuns } from './survivors.js';
import type { Judged, ModuleRun } from './survivors.js';
import { verdictOf } from './verdict.js';
import type { Measure } from './verdict.js';

async function measured(
    scope: MutationScope,
    stage: Stage,
    { cold, project }: { cold: boolean; project: string },
): Promise<Measured | { status: number }> {
    print(
        `${badge('TYPESCRIPT')} ${stage.name === 'suite' ? 'Measuring the whole suite against what the module tests let live, and the changed lines they do not run' : 'Measuring the module tests against mutants of the sources they test'}...\n\n`,
    );

    return await strykerRun(scope, stage, { buildsFirst: buildsOf(project), cold, project });
}

function printed(judged: Judged, untestedSources: number, measure: Measure): number {
    const verdict = verdictOf(judged, untestedSources, measure);
    print(`\n${verdict.lines.join('\n')}\n`);

    return verdict.status;
}

async function judgedAfterTheSuite({
    cold,
    modulesRun,
    project,
    ranges,
    scope,
    since,
    untested,
}: {
    cold: boolean;
    modulesRun: ModuleRun;
    project: string;
    ranges: readonly string[] | undefined;
    scope: MutationScope;
    since: Base;
    untested: readonly string[];
}): Promise<number> {
    const modulesAlone = judgedRuns(modulesRun);
    const measure: Measure = { range: since.range };
    // Stryker disable next-line ConditionalExpression: a mutant the run never judged fails the verdict whether or not the suite runs after it; the gate only spares the suite's minutes
    if (Object.keys(modulesAlone.unrun).length > 0) {
        return printed(modulesAlone, untested.length, measure);
    }
    const request = { ranges, since };
    const { changed, note } = changeOf(project, request);
    if (note !== undefined) {
        print(`${badge('TYPESCRIPT')} ${note}\n`);
    }
    const reached = changedRanges(untested, changed, (file) =>
        String(readFileSync(join(project, file))),
    );
    // invariant: `--mutate` names the lines to measure and the default run's policy for a static mutant stands: the module tests leave it to the suite only where the tree's own change reaches it.
    const statics = treeChangeFor(project, request, changed);
    const reach = { changed, statics };
    const handed = [...reached, ...handedToTheSuite(modulesRun, reach)];
    if (handed.length === 0) {
        return printed(modulesAlone, untested.length, measure);
    }
    return await afterStage(
        await measured(scope, { mutate: handed, name: 'suite' }, { cold, project }),
        ({ report }) =>
            printed(
                judgedRuns(modulesRun, { ...reach, report, untested: reached }),
                untested.length,
                measure,
            ),
    );
}

function refusedRange(range: string, where: string): number {
    print(
        `${RED}${refusal({
            fix: `name ${where}, by its path from the project's root and its lines as from-to — src/a.ts:10-20 — or the whole file by its path`,
            found: `--mutate names ${range}, which reaches no source the run mutates`,
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
): Promise<number> {
    const unowned = unownedRange(members, asked.ranges ?? []);
    if (unowned !== undefined) {
        return refusedRange(unowned, 'a source of a member of the workspace');
    }
    let status = 0;
    for (const { args, member } of memberRuns(members, asked)) {
        print(`${badge('TYPESCRIPT')} ${member}\n\n`);
        status = Math.max(status, await toolchainIn(join(project, member), ['mutation', ...args]));
    }

    return status;
}

function refusedSince(named: string): number {
    print(
        `${RED}${refusal({
            fix: 'name a commit this clone holds — fetch it — or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the change not yet committed, or, on a clean tree, the branch since its merge-base with the default branch',
            found: `git names no commit ${named}`,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing',
        })}${RESET}\n`,
    );

    return 1;
}

// invariant: a project with no module test and no `specs/` has nothing to run a mutant against; Stryker would stop on a missing test project, and the run says what it measured instead.
function measuredNothing(project: string): number {
    print(
        `${badge('TYPESCRIPT')} measured nothing: ${project} holds no module test and no specs/, so no test project to run a mutant against.\n`,
    );

    return 0;
}

export async function mutation(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const { cold, named, ranges } = askedOf(args);
    if (named !== undefined && !namesACommit(project, named)) {
        return refusedSince(named);
    }
    const members = workspaceMembers(project);
    if (members.length > 0) {
        return await membersMeasured(project, members, { cold, ranges, since: named });
    }
    const since: Base =
        named === undefined
            ? defaultBaseOf(project)
            : { commit: named, names: named, range: `${named}..working tree` };
    const scope = await mutationScopeOf(project);
    const { tested, untested } = sourcesOf(project, scope);
    if (tested.length === 0 && !existsSync(join(project, 'specs'))) {
        return measuredNothing(project);
    }
    const unreached = unreachedRange(ranges ?? [], new Set([...tested, ...untested]));
    if (unreached !== undefined) {
        return refusedRange(unreached, 'a source the run mutates');
    }
    strykerPrepared(project);

    const modules = narrowed(tested, ranges);
    const first =
        modules.length === 0
            ? undefined
            : await measured(scope, { mutate: modules, name: 'modules' }, { cold, project });

    return await afterStage(first, async ({ ranByTests, report }) => {
        const measuredFiles = new Set(modules.map((range) => fileOf(range)));

        return await judgedAfterTheSuite({
            cold,
            modulesRun: { measured: measuredFiles, ranByTests, report },
            project,
            ranges,
            scope,
            since,
            untested,
        });
    });
}
