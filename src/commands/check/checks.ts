import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { withStagedSuppressions } from '../../../lint/kit/baseline/oxlint-suppressions.js';
import { inScratch } from '../../../lint/kit/checker/ending.js';
import type { ProjectIdentity } from '../../../lint/kit/project/project-kind.js';
import { checker } from '../../drivers/checker/checker.js';
import { withGateLock } from '../gate-lock/lock.js';
import { configPass } from './passes/checker-passes.js';
import type { Launched } from './passes/launched.js';
import { secondsSince } from './passes/launched.js';
import { CONTENT_PASSES } from './passes/passes.js';
import type { Selected } from './passes/passes.js';
import { presetRuns } from './passes/presets.js';
import type { PresetRun } from './passes/presets.js';
import { argumentsOf, membersOf, targetsOf, toolConfigs, toolsOf } from './passes/setup.js';
import type { Check } from './passes/setup.js';
import { started } from './passes/started.js';
import type { Started } from './passes/started.js';
import {
    checkSummaryOf,
    checkVerdictOf,
    driftPassOf,
    passVerdictOf,
    verdictWritten,
} from './report/gate-verdict.js';
import type { PassVerdict } from './report/gate-verdict.js';
import { logsIn } from './report/logs.js';
import { reportPass } from './report/report.js';
import { badge, GREEN, print, RED, RESET } from './report/terminal.js';
import {
    lintVerdictOf,
    presetVerdicts,
    publishVerdict,
    settled,
    settledLint,
} from './report/verdicts.js';
import type { Verdict } from './report/verdicts.js';

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
    presets: readonly PresetRun[],
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

async function drift(run: Check): Promise<PassVerdict[]> {
    if (run.fix || !run.selected('drift')) {
        return [];
    }
    print(`\n${badge('DRIFT')} Deviations from the profile\n\n`);
    const from = performance.now();
    const status = await checker('drift', ['.', ...run.driftArgs], 'inherit');

    return [driftPassOf(status, secondsSince(from))];
}

function concluded(fix: boolean, passes: readonly PassVerdict[]): number {
    const verdict = checkVerdictOf(process.cwd(), { fix, passes });
    verdictWritten(process.cwd(), verdict);
    print(
        `\n${badge('END')} ${fix ? 'Finalizing quality fixes' : 'Finalizing quality checks'}\n\n`,
    );
    print(`${verdict.status === 0 ? GREEN : RED}${checkSummaryOf(verdict)}${RESET}\n`);

    return verdict.status;
}

export async function runChecks(
    args: readonly string[],
    { fix, selected }: { fix: boolean; selected: Selected },
): Promise<number> {
    return fix
        ? await checksRun(args, { fix, selected })
        : await withGateLock(process.cwd(), async () => await checksRun(args, { fix, selected }));
}

async function checksRun(
    args: readonly string[],
    { fix, selected }: { fix: boolean; selected: Selected },
): Promise<number> {
    return await withStagedSuppressions(
        process.cwd(),
        async () =>
            await inScratch(async (scratch) => {
                print(
                    `${badge('START')} ${fix ? 'Running quality fixes' : 'Running quality checks'}\n`,
                );
                const prepared = await preparedCheck(args, fix, selected, scratch);
                const config = configPass(prepared);
                const derived = await withDerivedConfigs(prepared, config);
                const presets = await presetRuns(derived);
                const run = await withTargets(derived);
                const passes = await started(run, config);
                const verdicts = await reported(run, passes, presets);
                for (const verdict of verdicts) {
                    reportPass(run.logs, verdict);
                }
                const drifted = await drift(run);

                return concluded(fix, [
                    ...verdicts.map((verdict) => passVerdictOf(verdict, run.logs.read)),
                    ...drifted,
                ]);
            }),
    );
}
