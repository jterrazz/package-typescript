import { join, relative } from 'node:path';
import ts from 'typescript';

/** The headline of the first error the compiler finds in the project's unmutated tree, as `file:line TS<code> <message>`, read through its `tsconfig.json` as Stryker's TypeScript checker reads it; none where the tree compiles, or keeps no `tsconfig.json` the checker could compile. */
export function firstCompileError(project: string): string | undefined {
    const tsconfig = join(project, 'tsconfig.json');
    const parsed = ts.getParsedCommandLineOfConfigFile(
        tsconfig,
        {},
        {
            ...ts.sys,
            onUnRecoverableConfigFileDiagnostic: () => undefined,
        },
    );
    if (parsed === undefined) {
        return undefined;
    }
    const program = ts.createProgram({ options: parsed.options, rootNames: parsed.fileNames });
    const [first] = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
    if (first === undefined) {
        return undefined;
    }
    const { messageText } = first;
    const message = typeof messageText === 'string' ? messageText : messageText.messageText;
    const { file, start } = first;
    if (file === undefined || start === undefined) {
        return `TS${String(first.code)} ${message}`;
    }
    const { line } = file.getLineAndCharacterOfPosition(start);

    return `${relative(project, file.fileName)}:${String(line + 1)} TS${String(first.code)} ${message}`;
}
