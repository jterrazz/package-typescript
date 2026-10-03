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
