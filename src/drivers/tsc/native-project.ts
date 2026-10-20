import { API } from '@typescript/native/sync';
import type { Diagnostic, Program, Snapshot } from '@typescript/native/sync';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { invariant } from '../../../lint/kit/catalogue/lesson.js';
import { objectOf } from '../../../lint/kit/project/json.js';

// outside: the options Stryker's own TypeScript checker forces on a project before it checks a mutant (@stryker-mutator/typescript-checker, tsconfig-helpers.js): code a mutant leaves unreachable or unused is no error of the mutant's.
const MUTANT_OPTIONS = {
    allowUnreachableCode: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
} as const;

const ERROR_CATEGORY = 1;

/** A project opened on the native compiler: its process, the snapshot of its unmutated tree, and the `tsconfig.json` the snapshot opened. */
export type NativeProject = { api: API; base: Snapshot; config: string };

/** Opens the project's `tsconfig.json` on the native compiler, under the options a mutant is checked by; none where the project keeps no `tsconfig.json`. */
export function nativeProject(project: string): NativeProject | undefined {
    const config = join(project, 'tsconfig.json');
    if (!existsSync(config)) {
        return undefined;
    }
    const api = new API({ cwd: project });
    const read = objectOf(api.readConfigFile(config).config);
    const adjusted = {
        ...read,
        compilerOptions: { ...objectOf(read.compilerOptions), ...MUTANT_OPTIONS },
    };
    const base = api.createSnapshot({
        fileSystem: { files: { [config]: JSON.stringify(adjusted) }, kind: 'layer' },
        openProjects: [config],
    });

    return { api, base, config };
}

/** The program a snapshot holds of the opened project. */
export function programOf(snapshot: Snapshot, config: string): Program {
    const opened = snapshot.getConfiguredProject(config);
    if (opened === undefined) {
        throw invariant(`the native compiler opened no project at ${config}`);
    }

    return opened.program;
}

/** Every error the program holds: its configuration, its options, its globals, then each file's syntax and types. */
export const programErrors = (program: Program): Diagnostic[] =>
    [
        ...program.getConfigFileParsingDiagnostics(),
        ...program.getProgramDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
    ].filter(({ category }) => category === ERROR_CATEGORY);

/** The errors of the syntax and types of these files of the program. */
export const fileErrors = (program: Program, files: readonly string[]): Diagnostic[] =>
    [...program.getSyntacticDiagnostics(files), ...program.getSemanticDiagnostics(files)].filter(
        ({ category }) => category === ERROR_CATEGORY,
    );

/** A diagnostic as `file:line TS<code> <message>`, its file read from the project; by its code and message alone where it has no file. */
export function headline(
    project: string,
    { code, fileName, startPosition, text }: Diagnostic,
): string {
    const coded = `TS${String(code)} ${text}`;

    return fileName === undefined || startPosition === undefined
        ? coded
        : `${relative(project, fileName)}:${String(startPosition.line + 1)} ${coded}`;
}
