import { checker } from '../checker.js';
import { inScratch } from '../scratch.js';
import { badge, GREEN, print, RED, RESET } from '../terminal.js';
import { toolConfigs } from '../tool-configs.js';
import { presetAt } from '../toolchain.js';
import { checkerMembers, conventions } from './conventions.js';
import type { Conventions } from './conventions.js';
import { logsIn } from './logs.js';
import type { Selected } from './passes.js';
import { reportPass } from './report.js';
import { argumentsOf, membersOf, targetsOf, toolsOf } from './setup.js';
import type { Check } from './setup.js';
import { started } from './started.js';
import type { Runs, Started } from './started.js';
import {
    commentsVerdict,
    conventionsVerdict,
    lintVerdictOf,
    publishVerdict,
    settled,
    settledLint,
} from './verdicts.js';
import type { Verdict } from './verdicts.js';

export { CHECK_PASSES, EVERY_PASS } from './passes.js';
export type { CheckPass, Selected } from './passes.js';

type Reported = Verdict & { label: string };

function preparedCheck(
    args: readonly string[],
    fix: boolean,
    selected: Selected,
    scratch: string,
): Check {
    const empty = { nothing: false, paths: [] };

    return {
        configs: toolConfigs(),
        ...argumentsOf(args),
        fix,
        formatTargets: empty,
        lintTargets: empty,
        logs: logsIn(scratch),
        members: membersOf(),
        selected,
        tools: toolsOf(),
    };
}

async function withTargets(prepared: Check, runsOxlint: boolean): Promise<Check> {
    const { configs, lintArgs } = prepared;

    return {
        ...prepared,
        formatTargets: prepared.selected('oxfmt')
            ? await targetsOf(lintArgs, { every: true, ignoresOf: configs.oxfmt.ignoresOf })
            : prepared.formatTargets,
        lintTargets: runsOxlint
            ? await targetsOf(lintArgs, { every: false, ignoresOf: configs.oxlint.ignoresOf })
            : prepared.lintTargets,
    };
}

function labelled(label: string, verdict: undefined | Verdict, writes?: boolean): Reported[] {
    return verdict === undefined
        ? []
        : [{ label, ...verdict, ...(writes === undefined ? {} : { writes }) }];
}

async function reported(
    run: Check,
    passes: Started,
    conventionRuns: Conventions,
): Promise<Reported[]> {
    const typescript = await settled(passes.typescript);
    const linted = await settledLint(run, passes);
    const comments = await commentsVerdict(run, passes);
    const [
        names,
        format,
        knip,
        gitignore,
        docs,
        suppressions,
        markdown,
        architecture,
        astro,
        secrets,
    ] = await Promise.all(
        [
            passes.names,
            passes.format,
            passes.knip,
            passes.gitignore,
            passes.docs,
            passes.suppressions,
            passes.markdown,
            passes.architecture,
            passes.astro,
            passes.secrets,
        ].map(async (launched) => await settled(launched)),
    );
    const conventionsPass = await conventionsVerdict(run, conventionRuns);
    const publish = await publishVerdict(run, passes.publish);
    const { fix, selected } = run;

    return [
        ...labelled('TypeScript Check', typescript),
        ...labelled(fix ? 'Oxlint Fix' : 'Oxlint Check', lintVerdictOf(run, linted)),
        ...labelled(fix ? 'Oxfmt Format' : 'Oxfmt Check', selected('oxfmt') ? format : undefined),
        ...labelled('Gitignore (artefacts)', gitignore, true),
        ...labelled('Knip (unused code)', knip),
        ...labelled('Test Conventions (@jterrazz/test)', conventionsPass),
        ...labelled('Docs (layout)', docs),
        ...labelled('Publish (packaging)', publish),
        ...labelled('Architecture (layer map)', architecture, fix),
        ...labelled('Astro (check + format)', astro, fix),
        ...labelled('Suppressions (directives)', suppressions, fix),
        ...labelled('Markdown (prose)', markdown, fix),
        ...labelled('Names (tree)', selected('names') ? names : undefined, fix),
        ...labelled('Comments (density)', selected('comments') ? comments : undefined, fix),
        ...labelled('Secrets (credentials)', secrets),
    ];
}

async function drift(run: Check): Promise<number> {
    if (run.fix || !run.selected('drift')) {
        return 0;
    }
    print(`\n${badge('DRIFT')} Deviations from the profile\n\n`);

    return await checker(
        'drift',
        [
            '.',
            '--oxlint',
            run.tools.oxlint,
            ...run.configs.oxlint.args,
            '--profiles',
            presetAt('dist/presets/oxlint/profiles'),
            ...run.lintArgs,
            ...run.driftArgs,
        ],
        'inherit',
    );
}

function concluded(fix: boolean, passed: boolean): number {
    print(
        `\n${badge('END')} ${fix ? 'Finalizing quality fixes' : 'Finalizing quality checks'}\n\n`,
    );
    print(
        passed ? `${GREEN}✓ All checks passed${RESET}\n` : `${RED}✗ Some checks failed${RESET}\n`,
    );

    return passed ? 0 : 1;
}

export async function runChecks(
    args: readonly string[],
    { fix, selected }: { fix: boolean; selected: Selected },
): Promise<number> {
    return await inScratch(async (scratch) => {
        print(`${badge('START')} ${fix ? 'Running quality fixes' : 'Running quality checks'}\n`);
        const prepared = preparedCheck(args, fix, selected, scratch);
        const members = checkerMembers(prepared);
        const runs: Runs = {
            comments: selected('comments'),
            names: selected('names'),
            oxlint: selected('oxlint'),
        };
        const run = await withTargets(prepared, runs.oxlint);
        const passes = await started(run, runs);
        const conventionRuns = conventions(run, members);
        const verdicts = await reported(run, passes, conventionRuns);
        for (const verdict of verdicts) {
            reportPass(run.logs, verdict);
        }
        const drifted = await drift(run);

        return concluded(fix, drifted === 0 && verdicts.every(({ status }) => status === 0));
    });
}
