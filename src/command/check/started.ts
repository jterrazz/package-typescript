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
import type { Member } from './checker-runs.js';
import type { Launched } from './launched.js';
import { oxfmt } from './runners.js';
import type { Check } from './setup.js';
import {
    astroPass,
    formatCheck,
    knipPass,
    lintFix,
    lintReport,
    typescriptPass,
} from './tool-passes.js';

export type Runs = { comments: boolean; names: boolean; oxlint: boolean };

export type Started = {
    architecture: Launched | undefined;
    astro: Launched | undefined;
    comments: Launched | undefined;
    docs: Launched | undefined;
    format: Launched | undefined;
    gitignore: Launched | undefined;
    knip: Launched | undefined;
    lint: Promise<number>;
    markdown: Launched | undefined;
    names: Launched | undefined;
    publish: Launched[];
    secrets: Launched | undefined;
    suppressions: Launched | undefined;
    typescript: Launched | undefined;
};

async function lintStarted(
    check: Check,
    runs: Runs,
): Promise<{ format: Launched | undefined; lint: Promise<number> }> {
    if (!check.fix) {
        return {
            format: formatCheck(check),
            lint: runs.oxlint ? lintReport(check) : Promise.resolve(0),
        };
    }
    const fixed = runs.oxlint && !check.lintTargets.nothing ? await lintFix(check) : 0;
    if (!check.selected('oxfmt')) {
        return { format: undefined, lint: Promise.resolve(fixed) };
    }
    const log = check.logs.at('format.log');
    const formatted = await oxfmt(check, [], log);

    return { format: { log, status: Promise.resolve(formatted) }, lint: Promise.resolve(fixed) };
}

export async function started(check: Check, runs: Runs): Promise<Started> {
    const typescript = typescriptPass(check);
    const { format, lint } = await lintStarted(check, runs);
    const knip = knipPass(check);
    const gitignore = await gitignorePass(check);
    const docs = docsPass(check);
    const suppressions = suppressionsPass(check);
    const markdown = markdownPass(check);
    const names = namesPass(check, runs.names);
    const comments = commentsPass(check, runs.comments);
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
