import { headline, nativeProject, programErrors, programOf } from './native-project.js';

/** What a run found when the tree it mutates does not compile, at the compiler's first error. */
export const uncompiledFound = (diagnostic: string): string =>
    `the tree does not compile before any mutant: ${diagnostic}`;

export const UNCOMPILED_WHY =
    'each mutant is type-checked against the tree it mutates, so a tree the compiler refuses leaves no mutant to judge; the tree must compile before mutants are judged';

export const UNCOMPILED_FIX =
    'make the tree compile, then run again: `typescript check` names every error, in its TypeScript Check pass';

/** The headline of the first error the compiler finds in the project's unmutated tree, as `file:line TS<code> <message>`, read through its `tsconfig.json` as the TypeScript checker reads it; none where the tree compiles, or keeps no `tsconfig.json` the checker could compile. */
export function firstCompileError(project: string): string | undefined {
    const opened = nativeProject(project);
    if (opened === undefined) {
        return undefined;
    }
    try {
        const [first] = programErrors(programOf(opened.base, opened.config));

        return first === undefined ? undefined : headline(project, first);
    } finally {
        opened.api.close();
    }
}
