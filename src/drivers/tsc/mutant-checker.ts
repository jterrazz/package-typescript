import { isStringLiteralLikeNode } from '@typescript/native/ast/is';
import type { Diagnostic, Program } from '@typescript/native/sync';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { invariant, refusal } from '../../../lint/kit/catalogue/lesson.js';
import { heldApart } from '../../../lint/kit/project/priced-apart.js';
import type { ImportGraph } from './affected-errors.js';
import { affectedErrors } from './affected-errors.js';
import { UNCOMPILED_FIX, UNCOMPILED_WHY, uncompiledFound } from './compile-error.js';
import { fileErrors, headline, nativeProject, programErrors, programOf } from './native-project.js';
import type { NativeProject } from './native-project.js';

type Position = { column: number; line: number };

/** A mutant as Stryker hands it to a checker: its file, the span it replaces, zero-based, and the text it puts there. */
export type CheckedMutant = {
    fileName: string;
    id: string;
    location: { end: Position; start: Position };
    replacement: string;
};

/** What a checker answers of one mutant, in Stryker's words. */
export type CheckResult = { reason: string; status: 'compileError' } | { status: 'passed' };

const offsetOf = (text: string, { column, line }: Position): number => {
    let offset = 0;
    for (let passed = 0; passed < line; passed += 1) {
        offset = text.indexOf('\n', offset) + 1;
    }

    return offset + column;
};

/** The text of a file with the mutant's replacement in place of the span it mutates. */
export const mutatedText = (text: string, { location, replacement }: CheckedMutant): string =>
    `${text.slice(0, offsetOf(text, location.start))}${replacement}${text.slice(offsetOf(text, location.end))}`;

/** The project's own files, what each imports read from the program, and those whose change no import bounds. */
export function importGraphOf(program: Program, files: readonly string[]): ImportGraph {
    const importers = new Map(files.map((file) => [file, new Set<string>()]));
    const global = new Set<string>();
    for (const file of files) {
        const source = program.getSourceFile(file);
        if (source === undefined) {
            continue;
        }
        if (source.externalModuleIndicator === undefined || source.moduleAugmentations.length > 0) {
            global.add(file);
        }
        for (const specifier of source.imports.filter(isStringLiteralLikeNode)) {
            const target = program.getResolvedModuleFromModuleSpecifier(specifier, file);
            // Stryker disable next-line StringLiteral: a name that no file of the graph bears adds an importer to none, as a missing name does
            importers.get(target?.resolvedFileName ?? '')?.add(file);
        }
    }

    return { global, importers };
}

const DECLARED = /(?<!\.d)\.[cm]?tsx?$/u;

/** How a file looks to the files that import it: its declarations as the compiler emits them; none where it cannot emit them, so its importers are checked. */
export function shapeOf(program: Program, file: string): string | undefined {
    if (!DECLARED.test(file)) {
        return undefined;
    }
    const emitted = program.getDeclarationEmit([file]);
    if (emitted.diagnostics.length > 0) {
        return undefined;
    }

    return [...emitted.outputFiles.values()].map(({ text }) => text).join('');
}

const UNCHECKED: CheckResult = { status: 'passed' };

// Stryker disable next-line StringLiteral: the files under node_modules are libraries and packages a mutant is never of, so holding them in the graph or not changes no answer, only its size
const isOwn = (file: string): boolean => !file.split('/').includes('node_modules');

/** Stryker's checker on the native compiler: the project opened once, each mutant checked on a snapshot that replaces its file's text, against the files its change reaches. */
export class NativeChecker {
    static inject = [] as const;

    private opened: NativeProject | undefined;

    private graph: ImportGraph = { global: new Set(), importers: new Map() };

    private readonly shapes = new Map<string, string | undefined>();

    private readonly texts = new Map<string, string>();

    private readonly project: string;

    private released: (() => void) | undefined;

    constructor(project: string = process.cwd()) {
        this.project = project;
    }

    async init(): Promise<void> {
        const { project } = this;
        const opened = nativeProject(project);
        if (opened === undefined) {
            throw invariant(
                'the TypeScript checker was started in a project that keeps no tsconfig.json',
            );
        }
        this.opened = opened;
        const program = programOf(opened.base, opened.config);
        const [first] = programErrors(program);
        if (first !== undefined) {
            const found = uncompiledFound(headline(project, first));
            throw new Error(
                refusal({
                    fix: UNCOMPILED_FIX,
                    found,
                    read: 'docs/reference/quality-checks.md#every-mutant-a-test-runs-is-detected',
                    why: UNCOMPILED_WHY,
                }),
            );
        }
        // Stryker disable next-line MethodExpression: the files under node_modules are libraries and packages a mutant is never of, so holding them in the graph or not changes no answer, only its size
        this.graph = importGraphOf(program, program.getSourceFileNames().filter(isOwn));
        this.released = heldApart();
    }

    async check(mutants: readonly CheckedMutant[]): Promise<Record<string, CheckResult>> {
        return Object.fromEntries(mutants.map((mutant) => [mutant.id, this.checked(mutant)]));
    }

    async dispose(): Promise<void> {
        this.opened?.api.close();
        this.released?.();
    }

    private checked(mutant: CheckedMutant): CheckResult {
        const file = resolve(this.project, mutant.fileName);
        const { opened } = this;
        if (opened === undefined || !this.graph.importers.has(file)) {
            return UNCHECKED;
        }
        const text = this.texts.get(file) ?? readFileSync(file, 'utf8');
        // Stryker disable next-line CallExpression: a cache: a file read again is the same text, so only the time of the reading differs
        this.texts.set(file, text);
        let found: readonly Diagnostic[] = [];
        opened.api.runWithTemporaryFileUpdate(
            opened.base,
            file,
            mutatedText(text, mutant),
            (next) => {
                const program = programOf(next, opened.config);
                found = affectedErrors(
                    this.graph,
                    file,
                    {
                        errors: (files) =>
                            files === undefined
                                ? programErrors(program)
                                : fileErrors(program, files),
                        // Stryker disable next-line ArrowFunction: a file with no known shape has its importers checked, and the unmutated tree holds no error there, so the errors found are the same and only the work differs
                        shape: (changed) => shapeOf(program, changed),
                    },
                    // Stryker disable next-line ArrowFunction: a file with no known base shape has its importers checked, and the unmutated tree holds no error there, so the errors found are the same and only the work differs
                    (unchanged) => this.baseShape(unchanged),
                );
            },
        );

        return found.length === 0
            ? UNCHECKED
            : {
                  reason: found.map((error) => headline(this.project, error)).join('\n'),
                  status: 'compileError',
              };
    }

    private baseShape(file: string): string | undefined {
        const { opened } = this;
        // Stryker disable next-line BooleanLiteral,BlockStatement: a shape never kept is no shape known, which has the importers checked and finds the same errors, only with more work
        if (!this.shapes.has(file) && opened !== undefined) {
            // Stryker disable next-line CallExpression: a shape never kept is no shape known, which has the importers checked and finds the same errors, only with more work
            this.shapes.set(file, shapeOf(programOf(opened.base, opened.config), file));
        }

        return this.shapes.get(file);
    }
}
