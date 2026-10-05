import { existsSync, globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, matchesGlob } from 'node:path';
import ts from 'typescript';

import { DEV_OUTPUT } from '../../lint/kit/project/build-plan.js';
import { ARTIFACTS, OUT } from './mutation-sources.js';
import type { Changed } from './mutation-survivors.js';

const NEVER_MUTATED = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.test-d.ts',
    '**/*.fixtures.ts',
    '**/_fixtures/**',
    '**/_expected/**',
];

export type MutationScope = { exclude: string[]; ignore: string[]; mutated: string[] };

const oneGlob = (globs: readonly string[]): string =>
    globs.length === 1 ? String(globs) : `{${globs.join(',')}}`;

const typeCheckedGlob = (mutated: readonly string[]): string =>
    oneGlob(mutated.map((glob) => glob.replace('*.', '!(*.test-d).')));

const TEST_SUFFIXES = ['.test.ts', '.test.tsx'];

/** Every source the run mutates, split by whether a module test sits beside it: the module tests measure the first, the whole suite the rest. */
export function sourcesOf(
    project: string,
    scope: MutationScope,
): { tested: string[]; untested: string[] } {
    const never = [...NEVER_MUTATED, ...scope.ignore];
    const hasItsTest = (file: string): boolean =>
        TEST_SUFFIXES.some((suffix) => existsSync(join(project, file.replace(/\.tsx?$/u, suffix))));
    const sources = [...new Set(scope.mutated.flatMap((glob) => globSync(glob, { cwd: project })))]
        .filter((file) => !never.some((pattern) => matchesGlob(file, pattern)))
        .toSorted();

    return {
        tested: sources.filter((file) => hasItsTest(file)),
        untested: sources.filter((file) => !hasItsTest(file)),
    };
}

export type Stage = {
    mutate: readonly string[];
    name: 'modules' | 'suite';
};

export const FILES = {
    modules: {
        config: 'stryker.config.json',
        incremental: 'incremental',
        report: 'report',
        sandbox: 'sandbox.mjs',
        vitest: 'vitest.config.mjs',
    },
    suite: {
        config: 'stryker.suite.config.json',
        incremental: 'suite-incremental',
        report: 'suite-report',
        sandbox: 'sandbox.suite.mjs',
        vitest: 'vitest.suite.config.mjs',
    },
} as const;

export function strykerConfig(scope: MutationScope, { mutate, name }: Stage): object {
    const files = FILES[name];
    const suite = name === 'suite';

    return {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${OUT}/${files.sandbox}`,
        checkers: [],
        concurrency: suite ? 6 : 8,
        coverageAnalysis: 'perTest',
        disableTypeChecks: typeCheckedGlob(scope.mutated),
        ...(suite ? { dryRunTimeoutMinutes: 60 } : {}),
        htmlReporter: { fileName: `${OUT}/${files.report}.html` },
        ignorePatterns: [
            `/${ARTIFACTS}/**`,
            `!/${OUT}/*.mjs`,
            `!/${OUT}/*.cjs`,
            `!/${DEV_OUTPUT}/**`,
        ],
        ignoreStatic: true,
        incremental: true,
        incrementalFile: `${OUT}/${files.incremental}.json`,
        jsonReporter: { fileName: `${OUT}/${files.report}.json` },
        mutate,
        plugins: [createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner')],
        reporters: ['clear-text', 'html', 'json', 'progress'],
        tempDirName: `${OUT}/tmp`,
        testRunner: 'vitest',
        timeoutMS: suite ? 60_000 : 30_000,
        vitest: { configFile: `${OUT}/${files.vitest}`, ...(suite ? { related: false } : {}) },
    };
}

export const fileOf = (range: string): string => range.replace(/:\d+(?::\d+)?-\d+(?::\d+)?/u, '');

/** The ranges `--mutate` names in the files given, or every file whole when it names none. */
export function narrowed(files: readonly string[], ranges?: readonly string[]): string[] {
    if (ranges === undefined) {
        return [...files];
    }
    const named = new Set(files);

    return ranges.filter((range) => named.has(fileOf(range)));
}

const NO_CODE = /^(?:$|\/\/|\/\*|\*\/|\*(?: |$)|import\s[^;]*;$)/u;

/** The last line of every node that starts on a line from `from` to `to`, or `to` when none ends past it: Stryker mutates only a node it holds whole, so a hunk opening a block, a call or a literal must reach its end. */
function lastLineOf(tree: ts.SourceFile, from: number, to: number): number {
    const lineAt = (position: number): number =>
        tree.getLineAndCharacterOfPosition(position).line + 1;
    let last = to;
    const visit = (node: ts.Node): void => {
        // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: a pruning only — a node ending before the hunk, and every node within it, starts before it too
        if (lineAt(node.end) < from) {
            return;
        }
        const start = lineAt(node.getStart(tree));
        if (start > to) {
            return;
        }
        if (start >= from) {
            last = Math.max(last, lineAt(node.end));
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(tree, visit);

    return last;
}

/** The untested sources the change reaches, each hunk holding code as a range of whole lines run to the end of every node it opens: a hunk of blank lines, comments and one-line imports holds no mutant, and would cost the suite's dry run for nothing. */
export function changedRanges(
    untested: readonly string[],
    changed: Changed,
    source: (file: string) => string,
): string[] {
    return untested.flatMap((file) => {
        const lines = changed.get(file);
        if (lines === undefined) {
            return [];
        }
        if (lines === true) {
            return [file];
        }
        const text = source(file);
        const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
        const textLines = text.split('\n');

        return lines
            .filter(([from, to]) =>
                textLines.slice(from - 1, to).some((line) => !NO_CODE.test(line.trim())),
            )
            .map(([from, to]) => `${file}:${from}-${lastLineOf(tree, from, to)}`);
    });
}
