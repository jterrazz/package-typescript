import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { withStagedSuppressions } from '../../../lint/kit/baseline/oxlint-suppressions.js';
import { inScratch } from '../../../lint/kit/checker/ending.js';
import type { ProjectIdentity } from '../../../lint/kit/project/project-kind.js';
import { checker } from '../../drivers/checker/checker.js';
import { withGateLock } from '../gate-lock/lock.js';
import { badge, print } from '../terminal.js';
import { secondsSince } from '../timing.js';
import { configPass } from './passes/checker-passes.js';
import type { Launched, Timed } from './passes/launched.js';
import { timedLaunch, timedLaunches } from './passes/launched.js';
import { CHECK_PASSES, CONTENT_PASSES } from './passes/passes.js';
import type { Selected } from './passes/passes.js';
import { presetRuns } from './passes/presets.js';
import type { PresetRun } from './passes/presets.js';
import { argumentsOf, membersOf, targetsOf, toolConfigs, toolsOf } from './passes/setup.js';
import type { Check } from './passes/setup.js';
import { started } from './passes/started.js';
import type { Started } from './passes/started.js';
import { ciConcluded, ciDriftPrinted, ciPassPrinted, ciPlaceOf } from './report/ci-report.js';
import type { CiRow } from './report/ci-report.js';
import {
    checkSummaryOf,
    checkVerdictOf,
    driftPassOf,
    passVerdictOf,
    verdictLineOf,
    verdictWritten,
} from './report/gate-verdict.js';
import type { PassVerdict } from './report/gate-verdict.js';
import { logsIn } from './report/logs.js';
import { provenAsked, provenRun } from './report/proven.js';
import { reportPass } from './report/report.js';
import {
    lintVerdictOf,
    presetVerdicts,
    publishVerdict,
    settled,
    settledLint,
} from './report/verdicts.js';
import type { Verdict } from './report/verdicts.js';
import { onGitHub } from './report/workflow-commands.js';

type Reported = Verdict & { label: string };

async function declarationsOf(
    units: readonly string[],
): Promise<Map<string, null | ProjectIdentity>> {
    const read = await Promise.all(
        units.map(async (unit) => {
            const { resolved } = await readSettings(unit);

            return [unit, resolved.declaration] as const;
        }),
    );

    return new Map(read);
}

async function preparedCheck(
    args: readonly string[],
    fix: boolean,
    selected: Selected,
    scratch: string,
): Promise<Check> {
    const empty = { nothing: false, paths: [] };
    const members = membersOf();
    const declarations = await declarationsOf(['.', ...members]);
    const content = declarations.get('.')?.kind === 'content';

    return {
        configs: toolConfigs(),
        declarations,
        ...argumentsOf(args),
        fix,
        formatTargets: empty,
        lintTargets: empty,
        logs: logsIn(scratch),
        members,
        selected: content ? (pass) => CONTENT_PASSES.has(pass) && selected(pass) : selected,
        tools: toolsOf(),
    };
}

async function withDerivedConfigs(prepared: Check, config: Launched | undefined): Promise<Check> {
    if (!prepared.fix || config === undefined) {
        return prepared;
    }
    await config.status;

    return { ...prepared, configs: toolConfigs() };
}

async function withTargets(prepared: Check): Promise<Check> {
    const { configs } = prepared;

    return {
        ...prepared,
        formatTargets: prepared.selected('oxfmt')
            ? await targetsOf({ every: true, ignoresOf: configs.oxfmt.ignoresOf })
            : prepared.formatTargets,
        lintTargets: prepared.selected('oxlint')
            ? await targetsOf({ every: false, ignoresOf: configs.oxlint.ignoresOf })
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
    presets: readonly (PresetRun & Timed)[],
): Promise<Reported[]> {
    const config = await settled(passes.config);
    const typescript = await settled(passes.typescript);
    const linted = await settledLint(run, passes);
    const [
        names,
        format,
        knip,
        gitignore,
        docs,
        suppressions,
        comments,
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
            passes.comments,
            passes.markdown,
            passes.architecture,
            passes.astro,
            passes.secrets,
        ].map(async (launched) => await settled(launched)),
    );
    const contributed = await presetVerdicts(run, presets);
    const publish = await publishVerdict(run, passes.publish);
    const { fix, selected } = run;

    return [
        ...labelled('Config (one file)', config, fix),
        ...labelled('TypeScript Check', typescript),
        ...labelled(fix ? 'Oxlint Fix' : 'Oxlint Check', lintVerdictOf(run, linted)),
        ...labelled(fix ? 'Oxfmt Format' : 'Oxfmt Check', selected('oxfmt') ? format : undefined),
        ...labelled('Gitignore (artefacts)', gitignore, true),
        ...labelled('Knip (unused code)', knip),
        ...contributed,
        ...labelled('Docs (layout)', docs),
        ...labelled('Publish (packaging)', publish),
        ...labelled('Architecture (layer map)', architecture, fix),
        ...labelled('Astro (check + format)', astro, fix),
        ...labelled('Suppressions (directives)', suppressions, fix),
        ...labelled('Comments (styles, scripts, YAML)', comments, fix),
        ...labelled('Markdown (prose)', markdown, fix),
        ...labelled('Names (tree)', selected('names') ? names : undefined, fix),
        ...labelled('Secrets (credentials)', secrets),
    ];
}

async function drift(run: Check, ci: boolean): Promise<PassVerdict[]> {
    if (run.fix || !run.selected('drift')) {
        return [];
    }
    print(
        ci
            ? '::group::drift (profile report)\n'
            : `\n${badge('DRIFT')} Deviations from the profile\n\n`,
    );
    const from = performance.now();
    // Stryker disable next-line StringLiteral: the checker resolves an empty root to the working directory, which '.' names
    const status = await checker('drift', ['.', ...run.driftArgs], 'inherit');
    const verdict = driftPassOf(status, secondsSince(from));
    if (ci) {
        print('::endgroup::\n');
    }

    return [verdict];
}

function concluded(
    fix: boolean,
    passes: readonly PassVerdict[],
    rows: readonly CiRow[] | undefined,
): number {
    const verdict = checkVerdictOf(process.cwd(), { fix, passes });
    verdictWritten(process.cwd(), verdict);
    if (rows !== undefined) {
        ciConcluded(fix ? 'fix' : 'check', rows, ciPlaceOf(process.cwd(), process.env));

        return verdict.status;
    }
    print(
        `\n${badge('END')} ${fix ? 'Finalizing quality fixes' : 'Finalizing quality checks'}\n\n`,
    );
    print(verdictLineOf(verdict.status, checkSummaryOf(verdict)));

    return verdict.status;
}

export async function runChecks(
    args: readonly string[],
    { fix, selected }: { fix: boolean; selected: Selected },
): Promise<number> {
    if (fix) {
        return await checksRun(args, { fix, selected });
    }
    const project = process.cwd();
    const gated = async (): Promise<number> =>
        await withGateLock(project, async () => await checksRun(args, { fix, selected }));
    // invariant: `--json` asks for the drift report itself, which a proof does not keep, so that run is never answered from one.
    if (args.includes('--json')) {
        return await gated();
    }

    const passes = CHECK_PASSES.filter((pass) => selected(pass));

    // Stryker disable next-line StringLiteral: the passes are listed in one fixed order, so any separator keys each selection apart
    return await provenRun(project, provenAsked('check', args, passes.join(',')), gated);
}

async function checksRun(
    args: readonly string[],
    { fix, selected }: { fix: boolean; selected: Selected },
): Promise<number> {
    return await withStagedSuppressions(
        process.cwd(),
        async () =>
            await inScratch(async (scratch) => {
                const ci = onGitHub(process.env);
                print(
                    ci
                        ? `▸ typescript ${fix ? 'fix' : 'check'}\n`
                        : `${badge('START')} ${fix ? 'Running quality fixes' : 'Running quality checks'}\n`,
                );
                const prepared = await preparedCheck(args, fix, selected, scratch);
                const config = timedLaunch(configPass(prepared));
                const derived = await withDerivedConfigs(prepared, config);
                const presetsFrom = performance.now();
                const presets = timedLaunches(await presetRuns(derived), presetsFrom);
                const run = await withTargets(derived);
                const passes = await started(run, config);
                const verdicts = await reported(run, passes, presets);
                const rows: CiRow[] = [];
                for (const verdict of verdicts) {
                    if (ci) {
                        rows.push(ciPassPrinted(run.logs, verdict));
                    } else {
                        reportPass(run.logs, verdict);
                    }
                }
                const drifted = await drift(run, ci);

                return concluded(
                    fix,
                    [
                        ...verdicts.map((verdict) => passVerdictOf(verdict, run.logs.read)),
                        ...drifted,
                    ],
                    ci ? [...rows, ...drifted.map((pass) => ciDriftPrinted(pass))] : undefined,
                );
            }),
    );
}
