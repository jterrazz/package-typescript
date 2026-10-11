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
import type { Launched } from './launched.js';
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
    architecture: Launched | undefined;
    astro: Launched | undefined;
    comments: Launched | undefined;
    config: Launched | undefined;
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

async function lintChecked(
    check: Check,
): Promise<{ format: Launched | undefined; lint: Promise<number> }> {
    return {
        format: formatCheck(check),
        lint: check.selected('oxlint') ? lintCheck(check) : Promise.resolve(0),
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
): (Launched | undefined)[] => [
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
    writers: readonly (Launched | undefined)[],
): Promise<{ format: Launched | undefined; lint: Promise<number> }> {
    await writersDone(writers);
    let formatting: Launched | undefined;
    if (check.selected('oxfmt')) {
        const log = check.logs.at('format.log');
        // Stryker disable next-line ArrayDeclaration: oxfmt reads a stand-in argument as one more path to format, and a path that names no file is skipped
        formatting = { log, status: Promise.resolve(await oxfmt(check, [], log)) };
    }
    const lint = fixed === undefined ? Promise.resolve(0) : lintJudged(check, fixed);

    return { format: formatting, lint };
}

export async function started(check: Check, config: Launched | undefined): Promise<Started> {
    const typescript = typescriptPass(check);
    const fixed =
        check.fix && check.selected('oxlint') && !check.lintTargets.nothing
            ? await lintFix(check)
            : undefined;
    const checked = check.fix ? undefined : await lintChecked(check);
    const knip = knipPass(check);
    const gitignore = await gitignorePass(check);
    const docs = docsPass(check);
    const suppressions = suppressionsPass(check);
    const comments = commentsPass(check);
    const markdown = markdownPass(check);
    const names = namesPass(check);
    const secrets = secretsPass(check);
    const astro = astroPass(check);
    const architecture = architecturePass(check);
    const publish = publishPasses(check);
    const { format, lint } =
        checked ??
        (await formattedLast(
            check,
            fixed,
            writersOf({
                architecture,
                astro,
                comments,
                config,
                gitignore,
                markdown,
                names,
                suppressions,
            }),
        ));

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
