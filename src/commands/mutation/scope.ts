import { existsSync, globSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

import { moduleTestOf } from '../../../lint/kit/project/ground.js';
import { lastLineReader } from '../../drivers/tsc/node-ends.js';
import type { Changed } from './survivors.js';

const NEVER_MUTATED = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.test-d.ts',
    '**/*.fixtures.ts',
    '**/__tests__/**',
    '**/__fixtures__/**',
    '**/__expected__/**',
];

export type MutationScope = { exclude: string[]; ignore: string[]; mutated: string[] };

const TEST_EXTENSIONS = ['.ts', '.tsx'];

/** Every source the run mutates, split by whether a module test sits in its folder's `__tests__/`: the module tests measure the first, the whole suite the rest. */
export function sourcesOf(
    project: string,
    scope: MutationScope,
): { tested: string[]; untested: string[] } {
    const never = [...NEVER_MUTATED, ...scope.ignore];
    const hasItsTest = (file: string): boolean => {
        const stem = file.replace(/\.tsx?$/u, '');

        return TEST_EXTENSIONS.some((extension) =>
            existsSync(join(project, moduleTestOf(`${stem}${extension}`))),
        );
    };
    const sources = [...new Set(scope.mutated.flatMap((glob) => globSync(glob, { cwd: project })))]
        .filter((file) => !never.some((pattern) => matchesGlob(file, pattern)))
        .toSorted();

    return {
        tested: sources.filter((file) => hasItsTest(file)),
        untested: sources.filter((file) => !hasItsTest(file)),
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

/** The untested sources the change reaches, each hunk holding code as a range of whole lines run to the end of every node it opens, as Stryker mutates only a node it holds whole: a hunk of blank lines, comments and one-line imports holds no mutant, and would cost the suite's dry run for nothing. */
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
        const lastLine = lastLineReader(file, text);
        const textLines = text.split('\n');

        return lines
            .filter(([from, to]) =>
                textLines.slice(from - 1, to).some((line) => !NO_CODE.test(line.trim())),
            )
            .map(([from, to]) => `${file}:${from}-${lastLine(from, to)}`);
    });
}
