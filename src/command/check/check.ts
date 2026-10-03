import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { withStagedSuppressions } from '../../../lint/kit/baseline/oxlint-suppressions.js';
import type { ProjectIdentity } from '../../../lint/kit/project/project-kind.js';
import { checker } from '../checker.js';
import { inScratch } from '../scratch.js';
import { badge, GREEN, print, RED, RESET } from '../terminal.js';
import { toolConfigs } from '../tool-configs.js';
import { logsIn } from './logs.js';
import type { Selected } from './passes.js';
import { presetRuns } from './presets.js';
import type { PresetRun } from './presets.js';
import { reportPass } from './report.js';
import { argumentsOf, membersOf, targetsOf, toolsOf } from './setup.js';
import type { Check } from './setup.js';
import { started } from './started.js';
import type { Started } from './started.js';
import { lintVerdictOf, presetVerdicts, publishVerdict, settled, settledLint } from './verdicts.js';
import type { Verdict } from './verdicts.js';

export { CHECK_PASSES, EVERY_PASS } from './passes.js';
export type { CheckPass, Selected } from './passes.js';

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

    return {
        configs: toolConfigs(),
        declarations: await declarationsOf(['.', ...members]),
        ...argumentsOf(args),
        fix,
        formatTargets: empty,
        lintTargets: empty,
        logs: logsIn(scratch),
        members,
        selected,
        tools: toolsOf(),
    };
}

async function withTargets(prepared: Check): Promise<Check> {
    const { configs, lintArgs } = prepared;

    return {
        ...prepared,
        formatTargets: prepared.selected('oxfmt')
            ? await targetsOf(lintArgs, { every: true, ignoresOf: configs.oxfmt.ignoresOf })
            : prepared.formatTargets,
        lintTargets: prepared.selected('oxlint')
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
        ...labelled('Markdown (prose)', markdown, fix),
        ...labelled('Names (tree)', selected('names') ? names : undefined, fix),
        ...labelled('Secrets (credentials)', secrets),
    ];
}

async function drift(run: Check): Promise<number> {
    if (run.fix || !run.selected('drift')) {
        return 0;
    }
    print(`\n${badge('DRIFT')} Deviations from the profile\n\n`);

    return await checker('drift', ['.', ...run.lintArgs, ...run.driftArgs], 'inherit');
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
    return await withStagedSuppressions(
        process.cwd(),
        async () =>
            await inScratch(async (scratch) => {
                print(
                    `${badge('START')} ${fix ? 'Running quality fixes' : 'Running quality checks'}\n`,
                );
                const prepared = await preparedCheck(args, fix, selected, scratch);
                const presets = await presetRuns(prepared);
                const run = await withTargets(prepared);
                const passes = await started(run);
                const verdicts = await reported(run, passes, presets);
                for (const verdict of verdicts) {
                    reportPass(run.logs, verdict);
                }
                const drifted = await drift(run);

                return concluded(
                    fix,
                    drifted === 0 && verdicts.every(({ status }) => status === 0),
                );
            }),
    );
}
