import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../../lint/kit/checker/command-line.js';
import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import type { Resolution } from '../../../lint/kit/project/preset.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { toolchainIn } from '../../drivers/node/node.js';
import { strykerPrepared, strykerRun } from '../../drivers/stryker/stryker.js';
import type { Measured, Stage } from '../../drivers/stryker/stryker.js';
import { badge, print, RED, RESET } from '../check/report/terminal.js';
import { changeOf, namesACommit } from './change.js';
import { memberRuns } from './members.js';
import { changedRanges, fileOf, narrowed, sourcesOf } from './scope.js';
import type { MutationScope } from './scope.js';
import { judgedRuns, leftToTheSuite, verdictOf } from './survivors.js';
import type { Judged, ModuleRun } from './survivors.js';

const extensionGlob = (extensions: readonly string[]): string =>
    extensions.length === 1 ? (extensions[0] ?? 'ts') : `{${extensions.join(',')}}`;

const prefixOf = (unit: string): string => (unit === '.' ? '' : `${unit}/`);

function sourceGlobsOf(unit: string, { resolved }: Resolution): string[] {
    return resolved.presets.flatMap(({ sources }) =>
        sources === undefined
            ? []
            : sources.roots.map(
                  (root) => `${prefixOf(unit)}${root}/**/*.${extensionGlob(sources.extensions)}`,
              ),
    );
}

// invariant: a unit's `typescript.mutation` globs are its standard's and its settings file's, read from the repository root.
function declaredOf(unit: string, { resolved }: Resolution): MutationScope {
    const declared = objectOf(objectOf(resolved.sections.typescript).mutation);
    const globs = (key: string): string[] =>
        Object.keys(objectOf(declared[key])).map((glob) => `${prefixOf(unit)}${glob}`);

    return { exclude: globs('exclude'), ignore: globs('ignore'), mutated: globs('mutate') };
}

async function mutationScopeOf(project: string): Promise<MutationScope> {
    const units = [['.', await readSettings(project)] satisfies [string, Resolution]];
    const declared = units.map(([unit, resolution]) => declaredOf(unit, resolution));

    return {
        exclude: declared.flatMap(({ exclude }) => exclude),
        ignore: declared.flatMap(({ ignore }) => ignore),
        mutated: [
            ...new Set([
                ...units.flatMap(([unit, resolution]) => sourceGlobsOf(unit, resolution)),
                ...declared.flatMap(({ mutated }) => mutated),
            ]),
        ],
    };
}

function buildsOf(project: string): boolean {
    try {
        const { scripts } = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return objectOf(scripts).build !== undefined;
    } catch {
        return false;
    }
}

async function measured(
    scope: MutationScope,
    stage: Stage,
    project: string,
): Promise<Measured | { status: number }> {
    print(
        `${badge('TYPESCRIPT')} ${stage.name === 'suite' ? 'Measuring the whole suite against the changed lines no module test runs' : 'Measuring the module tests against mutants of the sources they test'}...\n\n`,
    );

    return await strykerRun(scope, stage, { buildsFirst: buildsOf(project), project });
}

const NOTHING_MEASURED: Measured = { ranByTests: new Set(), report: undefined };

// invariant: a stage that measured nothing says nothing next; a failed one says Stryker's status.
async function afterStage(
    outcome: Measured | undefined | { status: number },
    next: (measured: Measured) => number | Promise<number>,
): Promise<number> {
    if (outcome !== undefined && 'status' in outcome) {
        return outcome.status;
    }

    return await next(outcome ?? NOTHING_MEASURED);
}

function printed(judged: Judged, untestedSources: number): number {
    const verdict = verdictOf(judged, untestedSources);
    print(`\n${verdict.lines.join('\n')}\n`);

    return verdict.status;
}

async function judgedAfterTheSuite({
    modulesRun,
    project,
    ranges,
    scope,
    since,
    untested,
}: {
    modulesRun: ModuleRun;
    project: string;
    ranges: readonly string[] | undefined;
    scope: MutationScope;
    since: string;
    untested: readonly string[];
}): Promise<number> {
    const modulesAlone = judgedRuns(modulesRun);
    // Stryker disable next-line ConditionalExpression: a mutant the run never judged fails the verdict whether or not the suite runs after it; the gate only spares the suite's minutes
    if (modulesAlone.survivors.length > 0 || Object.keys(modulesAlone.unrun).length > 0) {
        print(
            `${badge('TYPESCRIPT')} The module tests' verdict fails: the whole suite measures the change once it passes.\n`,
        );

        return printed(modulesAlone, untested.length);
    }
    const { changed, note } = changeOf(project, { ranges, since });
    if (note !== undefined) {
        print(`${badge('TYPESCRIPT')} ${note}\n`);
    }
    const reached = changedRanges(untested, changed, (file) =>
        String(readFileSync(join(project, file))),
    );
    const left = [...reached, ...leftToTheSuite(modulesRun, changed)];
    if (left.length === 0) {
        return printed(modulesAlone, untested.length);
    }
    return await afterStage(
        await measured(scope, { mutate: left, name: 'suite' }, project),
        ({ report }) =>
            printed(
                judgedRuns(modulesRun, { changed, report, untested: reached }),
                untested.length,
            ),
    );
}

// invariant: a workspace root keeps no vitest config: each member is measured in its own folder, as `cd <member> && typescript mutation` measures it, into its own `.artifacts/stryker/`.
async function membersMeasured(
    project: string,
    members: readonly string[],
    asked: { ranges: readonly string[] | undefined; since: string | undefined },
): Promise<number> {
    let status = 0;
    for (const { args, member } of memberRuns(members, asked)) {
        print(`${badge('TYPESCRIPT')} ${member}\n\n`);
        status = Math.max(status, await toolchainIn(join(project, member), ['mutation', ...args]));
    }

    return status;
}

const blankAsUnset = (value: string | undefined): string | undefined =>
    value === undefined || value.trim() === '' ? undefined : value;

export async function mutation(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const commandLine = readCommandLine(args, ['--mutate', '--since']);
    const ranges = commandLine.value('--mutate')?.split(',');
    const named =
        commandLine.value('--since') ?? blankAsUnset(process.env.TYPESCRIPT_MUTATION_SINCE);
    if (named !== undefined && !namesACommit(project, named)) {
        print(
            `${RED}${refusal({
                fix: 'name a commit this clone holds — fetch it, or name the merge-base with the default branch — or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the working tree against HEAD',
                found: `git names no commit ${named}`,
                read: 'docs/reference/quality-checks.md#mutation',
                why: 'the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing',
            })}${RESET}\n`,
        );

        return 1;
    }
    const members = workspaceMembers(project);
    if (members.length > 0) {
        return await membersMeasured(project, members, { ranges, since: named });
    }
    const since = named ?? 'HEAD';
    const scope = await mutationScopeOf(project);
    const { tested, untested } = sourcesOf(project, scope);
    strykerPrepared(project);

    const modules = narrowed(tested, ranges);
    const first =
        modules.length === 0
            ? undefined
            : await measured(scope, { mutate: modules, name: 'modules' }, project);

    return await afterStage(first, async ({ ranByTests, report }) => {
        const measuredFiles = new Set(modules.map((range) => fileOf(range)));

        return await judgedAfterTheSuite({
            modulesRun: { measured: measuredFiles, ranByTests, report },
            project,
            ranges,
            scope,
            since,
            untested,
        });
    });
}
