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
import {
    astroPass,
    formatCheck,
    knipPass,
    lintCheck,
    lintFix,
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

async function lintStarted(
    check: Check,
): Promise<{ format: Launched | undefined; lint: Promise<number> }> {
    if (!check.fix) {
        return {
            format: formatCheck(check),
            lint: check.selected('oxlint') ? lintCheck(check) : Promise.resolve(0),
        };
    }
    const fixed = check.selected('oxlint') && !check.lintTargets.nothing ? await lintFix(check) : 0;
    if (!check.selected('oxfmt')) {
        return { format: undefined, lint: Promise.resolve(fixed) };
    }
    const log = check.logs.at('format.log');
    const formatted = await oxfmt(check, [], log);

    return { format: { log, status: Promise.resolve(formatted) }, lint: Promise.resolve(fixed) };
}

export async function started(check: Check, config: Launched | undefined): Promise<Started> {
    const typescript = typescriptPass(check);
    const { format, lint } = await lintStarted(check);
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
