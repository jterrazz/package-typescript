import {
    architecturePass,
    commentsPass,
    docsPass,
    gitignorePass,
    markdownPass,
    namesPass,
    publishPasses,
    secretsPass,
    suppressionsPass,
} from './checker-passes.js';
import { launched, timed, timedLaunch, timedLaunches } from './launched.js';
import type { Launched, Timed, TimedLaunch } from './launched.js';
import { oxfmt } from './runners.js';
import type { Check } from './setup.js';
import type { Fixed } from './tool-passes.js';
import {
    astroPass,
    formatCheck,
    knipPass,
    lintCheck,
    lintFix,
    lintJudged,
    typescriptPass,
} from './tool-passes.js';

export type Started = {
    architecture: TimedLaunch | undefined;
    astro: TimedLaunch | undefined;
    comments: TimedLaunch | undefined;
    config: TimedLaunch | undefined;
    docs: TimedLaunch | undefined;
    format: TimedLaunch | undefined;
    gitignore: TimedLaunch | undefined;
    knip: TimedLaunch | undefined;
    lint: Timed;
    markdown: TimedLaunch | undefined;
    names: TimedLaunch | undefined;
    publish: TimedLaunch[];
    secrets: TimedLaunch | undefined;
    suppressions: TimedLaunch | undefined;
    typescript: TimedLaunch | undefined;
};

async function lintChecked(
    check: Check,
): Promise<{ format: TimedLaunch | undefined; lint: Timed }> {
    return {
        format: timedLaunch(formatCheck(check)),
        lint: timed(check.selected('oxlint') ? lintCheck(check) : Promise.resolve(0)),
    };
}

/** The passes that write files in a fix, in the order they are launched: the formatter waits for each of them. */
export const writersOf = (
    passes: Pick<
        Started,
        | 'architecture'
        | 'astro'
        | 'comments'
        | 'config'
        | 'gitignore'
        | 'markdown'
        | 'names'
        | 'suppressions'
    >,
): (TimedLaunch | undefined)[] => [
    passes.architecture,
    passes.astro,
    passes.comments,
    passes.config,
    passes.gitignore,
    passes.markdown,
    passes.names,
    passes.suppressions,
];

/** Resolves once every writer has ended, whatever its status: a writer that failed has laid down what it could. */
export async function writersDone(writers: readonly (Launched | undefined)[]): Promise<void> {
    // Stryker disable next-line OptionalChaining: a launch that is missing throws inside the async arrow, and `allSettled` takes that rejection as the end of that writer all the same
    await Promise.allSettled(writers.map(async (writer) => await writer?.status));
}

// invariant: the formatter writes last: every other writer of a fix has laid its text down, and a size cap is judged on the layout the formatter leaves.
async function formattedLast(
    check: Check,
    fixed: Fixed | undefined,
    writers: readonly (TimedLaunch | undefined)[],
    from: number,
): Promise<{ format: TimedLaunch | undefined; lint: Timed }> {
    await writersDone(writers);
    let formatting: TimedLaunch | undefined;
    if (check.selected('oxfmt')) {
        const log = check.logs.at('format.log');
        // Stryker disable next-line ArrayDeclaration: oxfmt reads a stand-in argument as one more path to format, and a path that names no file is skipped
        formatting = launched(log, oxfmt(check, [], log));
        await formatting.status;
    }
    const lint = timed(fixed === undefined ? Promise.resolve(0) : lintJudged(check, fixed), from);

    return { format: formatting, lint };
}

export async function started(check: Check, config: TimedLaunch | undefined): Promise<Started> {
    const from = performance.now();
    const typescript = timedLaunch(typescriptPass(check));
    const fixed =
        check.fix && check.selected('oxlint') && !check.lintTargets.nothing
            ? await lintFix(check)
            : undefined;
    const checked = check.fix ? undefined : await lintChecked(check);
    const knip = timedLaunch(knipPass(check));
    const gitignore = timedLaunch(await gitignorePass(check));
    const docs = timedLaunch(docsPass(check));
    const suppressions = timedLaunch(suppressionsPass(check));
    const comments = timedLaunch(commentsPass(check));
    const markdown = timedLaunch(markdownPass(check));
    const names = timedLaunch(namesPass(check));
    const secrets = timedLaunch(secretsPass(check));
    const astro = timedLaunch(astroPass(check));
    const architecture = timedLaunch(architecturePass(check));
    const publish = timedLaunches(publishPasses(check));
    // Stryker disable next-line ObjectLiteral: the formatter waiting for no writer lays its text down after theirs in every run a spec can stage, an order between processes that is no value to read
    const writing = writersOf({
        architecture,
        astro,
        comments,
        config,
        gitignore,
        markdown,
        names,
        suppressions,
    });
    const { format, lint } = checked ?? (await formattedLast(check, fixed, writing, from));

    return {
        architecture,
        astro,
        comments,
        config,
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
