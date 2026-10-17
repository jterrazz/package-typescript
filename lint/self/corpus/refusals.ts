import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

import { refusal } from '../../kit/catalogue/lesson.js';
import { syntaxWalk } from '../../kit/testing/syntax-walk.js';

const LESSON_MODULE = 'lint/kit/catalogue/lesson.ts';

const ID = 'error-is-a-refusal-or-an-invariant';

const WHY =
    'an error a project can cause is read by the agent that caused it, so it says what was found, why it matters, how to fix it and where to read; one only the toolchain can cause says the bug is ours';

const READ = 'docs/guides/test.md#where-each-rule-declares-it';

const BUILT_IN_ERRORS: ReadonlySet<string> = new Set([
    'AggregateError',
    'Error',
    'EvalError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',
]);

const CHAPTER_ANCHOR = /^(?:read: )?(?<chapter>docs\/[^#\s]+\.md)#(?<anchor>[^\s'"`]+)$/u;

export type RefusalFinding = { column: number; line: number; message: string; path: string };

type Parsed = { path: string; source: ts.SourceFile };

type Taught = { at: ts.Node; fix: string; found: string };

function errorClasses(modules: readonly Parsed[]): ReadonlySet<string> {
    const classes = new Set(BUILT_IN_ERRORS);
    const declared: { name: string; parent: string }[] = [];
    for (const { source } of modules) {
        syntaxWalk(source, (node) => {
            const parent = ts.isClassDeclaration(node)
                ? node.heritageClauses?.[0]?.types[0]?.expression
                : undefined;
            if (ts.isClassDeclaration(node) && node.name !== undefined && parent !== undefined) {
                declared.push({ name: node.name.text, parent: parent.getText(source) });
            }
        });
    }
    let grew = true;
    while (grew) {
        const before = classes.size;
        for (const { name } of declared.filter(({ parent }) => classes.has(parent))) {
            classes.add(name);
        }
        grew = classes.size > before;
    }

    return classes;
}

const calleeName = (node: ts.CallExpression | ts.NewExpression): string | undefined =>
    ts.isIdentifier(node.expression) ? node.expression.text : undefined;

const isRefusalCall = (node: ts.Node | undefined): node is ts.CallExpression =>
    node !== undefined && ts.isCallExpression(node) && calleeName(node) === 'refusal';

function isStackRead(node: ts.Node): boolean {
    const { parent } = node;

    return (
        (ts.isPropertyAccessExpression(parent) && parent.name.text === 'stack') ||
        (ts.isVariableDeclaration(parent) &&
            ts.isObjectBindingPattern(parent.name) &&
            parent.name.elements.some((element) => element.name.getText() === 'stack'))
    );
}

function constructions(source: ts.SourceFile, classes: ReadonlySet<string>): Taught[] {
    const found: Taught[] = [];
    syntaxWalk(source, (node) => {
        if (!ts.isNewExpression(node) && !ts.isCallExpression(node)) {
            return;
        }
        const name = calleeName(node);
        const constructs =
            name !== undefined &&
            (ts.isNewExpression(node) ? classes.has(name) : BUILT_IN_ERRORS.has(name));
        const message = node.arguments?.[name === 'AggregateError' ? 1 : 0];
        if (!constructs || isStackRead(node) || isRefusalCall(message)) {
            return;
        }
        found.push({
            at: node,
            fix: `a project can cause it: \`new ${name}(refusal({ found, why, fix, read }))\`, its read the heading that explains it; only the toolchain can: \`invariant('<what broke>')\``,
            found: `\`${ts.isNewExpression(node) ? 'new ' : ''}${name}(...)\` carries a message written by hand`,
        });
    });

    return found;
}

function lessonsIn(argument: ts.Expression): ts.ObjectLiteralExpression[] {
    if (ts.isConditionalExpression(argument)) {
        return [...lessonsIn(argument.whenTrue), ...lessonsIn(argument.whenFalse)];
    }

    return ts.isObjectLiteralExpression(argument) ? [argument] : [];
}

function readsWrittenElsewhere(source: ts.SourceFile): Taught[] {
    const found: Taught[] = [];
    syntaxWalk(source, (node) => {
        const argument = isRefusalCall(node) ? node.arguments[0] : undefined;
        for (const lesson of argument === undefined ? [] : lessonsIn(argument)) {
            const read = lesson.properties.find(
                (property) => property.name?.getText(source) === 'read',
            );
            const value =
                read !== undefined && ts.isPropertyAssignment(read) ? read.initializer : read;
            const branches =
                value !== undefined && ts.isConditionalExpression(value)
                    ? [value.whenTrue, value.whenFalse]
                    : [value];
            for (const branch of branches) {
                if (branch === undefined || !ts.isStringLiteralLike(branch)) {
                    found.push({
                        at: branch ?? lesson,
                        fix: "write the heading it reads in place: `read: 'docs/<chapter>.md#<heading>'`",
                        found: 'the refusal reads no chapter written in place',
                    });
                }
            }
        }
    });

    return found;
}

function anchorOf(heading: string): string {
    return heading
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replaceAll(/\s/gu, '-');
}

export function headingsOf(markdown: string): ReadonlySet<string> {
    return new Set(
        [...markdown.matchAll(/^#{1,6}\s+(?<heading>.+)$/gmu)].map(({ groups }) =>
            anchorOf(groups?.heading ?? ''),
        ),
    );
}

function isHeading(root: string, chapter: string, anchor: string): boolean {
    const path = join(root, chapter);

    return existsSync(path) && headingsOf(readFileSync(path, 'utf8')).has(anchor);
}

function unreadHeadings(source: ts.SourceFile, root: string): Taught[] {
    const found: Taught[] = [];
    syntaxWalk(source, (node) => {
        const groups = ts.isStringLiteralLike(node)
            ? CHAPTER_ANCHOR.exec(node.text)?.groups
            : undefined;
        if (groups === undefined) {
            return;
        }
        const { anchor = '', chapter = '' } = groups;
        if (!isHeading(root, chapter, anchor)) {
            found.push({
                at: node,
                fix: 'read a heading that exists, and write the section that explains the refusal where none does',
                found: `\`${chapter}#${anchor}\` names a heading no chapter has`,
            });
        }
    });

    return found;
}

export function refusalFindings(root: string, modules: readonly string[]): RefusalFinding[] {
    const parsed = modules
        .filter((module) => module !== LESSON_MODULE)
        .map((path) => ({
            path,
            source: ts.createSourceFile(
                path,
                readFileSync(join(root, path), 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            ),
        }));
    const classes = errorClasses(parsed);

    return parsed.flatMap(({ path, source }) =>
        [
            ...constructions(source, classes),
            ...readsWrittenElsewhere(source),
            ...unreadHeadings(source, root),
        ].map(({ at, fix, found }) => {
            const { character, line } = source.getLineAndCharacterOfPosition(at.getStart(source));

            return {
                column: character + 1,
                line: line + 1,
                message: refusal({ fix, found, read: READ, why: WHY }),
                path,
            };
        }),
    );
}

export function refusalLine({ column, line, message, path }: RefusalFinding): string {
    return `${path}:${String(line)}:${String(column)}  ${ID}  ${message}`;
}
