import { isDeepStrictEqual } from 'node:util';

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
    | { additions: Readonly<Record<string, unknown>>; problem: null }
    | { additions: null; problem: string };

export function tsconfigAdditionsOf(section: unknown): TsconfigAdditions {
    const written = isRecord(section) ? section.tsconfig : undefined;
    if (written === undefined) {
        return { additions: {}, problem: null };
    }
    if (!isRecord(written) || typeof written.reason !== 'string' || written.reason.trim() === '') {
        return {
            additions: null,
            problem: 'sets `typescript.tsconfig` with no `reason`',
        };
    }
    const { compilerOptions, include } = written;

    return {
        additions: {
            ...(isRecord(compilerOptions) ? { compilerOptions } : {}),
            ...(Array.isArray(include) ? { include } : {}),
        },
        problem: null,
    };
}

export function derivedEditorFiles(
    declared: readonly Readonly<Record<string, EditorFile>>[],
    additions: Readonly<Record<string, unknown>> | null,
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
    files['tsconfig.json'] = { ...tsconfig, json: { ...tsconfig.json, ...additions } };

    return files;
}
