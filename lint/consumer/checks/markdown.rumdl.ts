import { dirname, join, relative, resolve } from 'node:path';

import type { Context, Finding, Tool } from '../../kit/checker/pass.js';
import { runTool } from '../../kit/checker/tool-run.js';
import { ignoredPaths } from '../../kit/project/project-files.js';

const OWN_RUMDL_CONFIGS = ['.rumdl.toml', 'rumdl.toml'];

type RumdlWarning = { column: number; file: string; line: number; message: string };

const isWarning = (value: unknown): value is RumdlWarning =>
    typeof value === 'object' && value !== null && 'file' in value && 'message' in value;

// invariant: what is no JSON report — a crash, a refusal — reports no link here: the pass's own rumdl run prints it.
function warningsOf(output: string): RumdlWarning[] {
    try {
        const parsed: unknown = JSON.parse(output);

        return Array.isArray(parsed) ? parsed.filter((value) => isWarning(value)) : [];
    } catch {
        return [];
    }
}

// Stryker disable next-line Regex: rumdl opens every MD057 message on these words
const LINK_TARGET = /^Relative link '(?<target>[^']+)'/u;

const RELATIVE_LINKS = 'MD057';

// invariant: a link into a tree git ignores (a clone on the bench, a build product) is forgiven as `markdown/path-resolves` forgives a backticked path there — rumdl's MD057 cannot ask git, so the pass runs it apart and asks.
export function brokenLinks(context: Context, pages: readonly string[]): Finding[] {
    if (pages.length === 0) {
        return [];
    }
    // Stryker disable StringLiteral: the name and the fallback reach only a refusal no JSON report holds, which reports no link; the command hands the binary by flag
    const run = runTool(
        'rumdl',
        context.value('--rumdl', 'rumdl'),
        // Stryker restore StringLiteral
        [
            'check',
            '--no-cache',
            '--quiet',
            '--enable',
            RELATIVE_LINKS,
            '--output-format',
            'json',
            ...pages,
        ],
        context.root,
    );
    const located = warningsOf(run.output).map((warning) => {
        // outside: rumdl names the link's file alone, its anchor dropped.
        // Stryker disable next-line OptionalChaining,StringLiteral: a match always carries its groups; a message naming no link reaches the root, which git never ignores
        const target = LINK_TARGET.exec(warning.message)?.groups?.target ?? '';

        return {
            target: relative(context.root, resolve(context.root, dirname(warning.file), target)),
            warning,
        };
    });
    const ignored = ignoredPaths(
        context.root,
        located.map(({ target }) => target).filter((target) => !target.startsWith('..')),
    );

    return located
        .filter(({ target }) => !ignored.has(target))
        .map(({ warning: { column, file, line, message } }) => ({
            column,
            line,
            message,
            path: file,
            rule: 'markdown/link-resolves',
        }));
}

export function rumdl(context: Context, pages: readonly string[]): Tool[] {
    if (pages.length === 0) {
        return [];
    }
    const own = OWN_RUMDL_CONFIGS.some((name) => context.exists(join(context.root, name)));

    return [
        {
            args: [
                'check',
                '--no-cache',
                '--quiet',
                '--extend-disable',
                RELATIVE_LINKS,
                // Stryker disable next-line StringLiteral: the command always hands the preset by flag
                ...(own ? [] : ['--config', context.value('--rumdl-config', '')]),
                ...(context.fix ? ['--fix'] : []),
                ...pages,
            ],
            flag: '--rumdl',
            name: 'rumdl',
        },
    ];
}
