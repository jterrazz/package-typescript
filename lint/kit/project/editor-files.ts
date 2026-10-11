import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { verbatimRootsOf } from './byte-for-byte.js';
import { PACKAGE_ROOT } from './package-root.js';

export type EditorFileScope = 'repository' | 'unit';

export type EditorFile =
    | { json: unknown; scope: EditorFileScope }
    | { scope: EditorFileScope; text: string };

export const editorFileText = (file: EditorFile): string =>
    'text' in file ? file.text : `${JSON.stringify(file.json, null, 4)}\n`;

function parsed(written: string): unknown {
    try {
        return JSON.parse(written);
    } catch {
        return undefined;
    }
}

export const holdsEditorFile = (written: string, file: EditorFile): boolean =>
    'text' in file
        ? written.trim() === file.text.trim()
        : isDeepStrictEqual(parsed(written), file.json);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export type TsconfigAdditions =
    | { additions: null; problem: string }
    | { additions: Readonly<Record<string, unknown>>; problem: null };

// invariant: a root declared verbatim is no source of the project: the compiler never reads it.
function verbatimExclusions(section: unknown): Record<string, unknown> {
    const excluded = verbatimRootsOf(section).map((root) => `\${configDir}/${root}`);

    return excluded.length === 0 ? {} : { exclude: excluded };
}

export function tsconfigAdditionsOf(section: unknown): TsconfigAdditions {
    const written = isRecord(section) ? section.tsconfig : undefined;
    const verbatim = verbatimExclusions(section);
    if (written === undefined) {
        return { additions: verbatim, problem: null };
    }
    if (!isRecord(written) || typeof written.reason !== 'string' || written.reason.trim() === '') {
        return {
            additions: null,
            problem: 'sets `typescript.tsconfig` with no `reason`',
        };
    }
    const { compilerOptions, files, include } = written;

    return {
        additions: {
            ...(isRecord(compilerOptions) ? { compilerOptions } : {}),
            ...(Array.isArray(files) ? { files } : {}),
            ...(Array.isArray(include) ? { include } : {}),
            ...verbatim,
        },
        problem: null,
    };
}

const PRESET = /^@jterrazz\/typescript\/tsconfig\/(?<name>[a-z]+)$/u;

// invariant: a tsconfig's `include` and `exclude` replace the ones it extends, so what a project adds is written beside its preset's, never in their place.
function presetListOf(extended: unknown, key: 'exclude' | 'include'): unknown[] {
    // Stryker disable next-line ConditionalExpression,OptionalChaining: a value that is no string spells no preset, nor does an unmatched one; either names a file no preset is
    const name = typeof extended === 'string' ? PRESET.exec(extended)?.groups?.name : undefined;
    try {
        // invariant: a name no preset holds is a file that does not read, which reads as no globs.
        const file = join(PACKAGE_ROOT, 'src/presets/tsconfig', `${String(name)}.json`);
        const preset: unknown = JSON.parse(readFileSync(file).toString());

        const list = isRecord(preset) ? preset[key] : undefined;

        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function joined(
    json: Readonly<Record<string, unknown>>,
    additions: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
    const lists: Record<string, unknown[]> = {};
    for (const key of ['exclude', 'include'] as const) {
        const added: unknown = additions[key];
        if (Array.isArray(added)) {
            const own: readonly unknown[] = added;
            lists[key] = [...presetListOf(json.extends, key), ...own];
        }
    }

    return { ...json, ...additions, ...lists };
}

export function derivedEditorFiles(
    declared: readonly Readonly<Record<string, EditorFile>>[],
    additions: null | Readonly<Record<string, unknown>>,
): Readonly<Record<string, EditorFile>> {
    const files: Record<string, EditorFile> = {};
    for (const one of declared) {
        Object.assign(files, one);
    }
    const tsconfig = files['tsconfig.json'];
    if (tsconfig === undefined || !('json' in tsconfig) || !isRecord(tsconfig.json)) {
        return files;
    }
    if (additions === null) {
        return Object.fromEntries(
            Object.entries(files).filter(([name]) => name !== 'tsconfig.json'),
        );
    }
    files['tsconfig.json'] = { ...tsconfig, json: joined(tsconfig.json, additions) };

    return files;
}
