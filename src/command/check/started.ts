import process from 'node:process';

import { run } from '../processes.js';
import {
    architecturePass,
    commentsPass,
    docsPass,
    gitignorePass,
    markdownPass,
    namesPass,
    publishPasses,
    secretsPass,
    specsRuns,
    suppressionsPass,
} from './checker-runs.js';
import type { Launched, Member } from './launched.js';
import {
    astroPass,
    formatCheck,
    knipPass,
    lintFix,
    lintReport,
    typescriptPass,
} from './linters.js';
import { oxfmt } from './runners.js';
import type { Check } from './setup.js';

export type Runs = { comments: boolean; names: boolean; oxlint: boolean };

async function lintStarted(
    check: Check,
    runsOf: Runs,
): Promise<{ format: Launched | undefined; lint: Promise<number> }> {
    if (!check.fix) {
        return {
            format: formatCheck(check),
            lint: runsOf.oxlint ? lintReport(check) : Promise.resolve(0),
        };
    }
    const fixed = runsOf.oxlint && !check.lintTargets.nothing ? await lintFix(check) : 0;
    if (!check.selected('oxfmt')) {
        return { format: undefined, lint: Promise.resolve(fixed) };
    }
    const log = check.logs.at('format.log');
    const formatted = await oxfmt(check, [], log);

    return { format: { log, status: Promise.resolve(formatted) }, lint: Promise.resolve(fixed) };
}

export async function started(check: Check, runsOf: Runs) {
    const typescript = typescriptPass(check);
    const { format, lint } = await lintStarted(check, runsOf);
    const knip = knipPass(check);
    const gitignore = await gitignorePass(check);
    const docs = docsPass(check);
    const suppressions = suppressionsPass(check);
    const markdown = markdownPass(check);
    const names = namesPass(check, runsOf.names);
    const comments = commentsPass(check, runsOf.comments);
    const secrets = secretsPass(check);
    const astro = astroPass(check);
    const architecture = architecturePass(check);
    const publish = publishPasses(check);

    return {
        architecture,
        astro,
        comments,
        docs,
        format,
        gitignore,
        knip,
        lint,
        markdown,
        names,
        publish,
        secrets,
        suppressions,
        typescript,
    };
}

export type Started = Awaited<ReturnType<typeof started>>;

function memberRuns(
    check: Check,
    members: readonly Member[],
): { launched: Launched[]; rootLog: string | undefined } {
    let rootLog: string | undefined;
    const launched = members.map(({ bin, member }, index) => {
        const log = check.logs.at(`checker-member-${String(index)}.log`);
        rootLog = member === '.' ? log : rootLog;
        const args = [bin, '--member', member, '--oxlint-report', check.logs.at('lint.json')];

        return {
            log,
            status: run(process.execPath, args, { stderr: 'stdout', stdout: { path: log } }),
        };
    });

    return { launched, rootLog };
}

export type Conventions = { rootLog: string | undefined; runs: Launched[] };

export async function conventions(
    check: Check,
    members: readonly Member[],
    lint: Promise<number>,
): Promise<Conventions> {
    const specs = specsRuns(check);
    if (members.length > 0) {
        await lint;
    }
    const { launched, rootLog } = memberRuns(check, members);

    return { rootLog, runs: [...specs, ...launched] };
}
