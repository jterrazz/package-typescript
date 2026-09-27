import type { Finding } from '../checker/pass.js';
import { lessonOf, lessonsOf, refusal } from './lesson.js';
import type { ChapterAnchor, Taught, Teaching } from './lesson.js';

export type Audience = 'consumer' | 'self';

export type RuleDocs = {
    audience: Audience;
    family: string;
    fix: string;
    name: string;
    sentence: string;
};

export type RuleType = 'layout' | 'problem' | 'suggestion';

export function rowNamed<Row extends { name: string }>(rows: readonly Row[], name: string): Row {
    const row = rows.find((entry) => entry.name === name);
    if (row === undefined) {
        throw new Error(
            refusal({
                fix: `add a row named \`${name}\` to the catalogue, or name a row it holds`,
                found: `no catalogue row is named \`${name}\``,
                read: 'docs/09-rules-kit.md#a-rule-is-a-catalogue-row',
                why: 'a rule reads its sentence, family and audience from its row, and a rule with no row teaches nothing',
            }),
        );
    }

    return row;
}

export const byName = <Row extends { name: string }>(rows: readonly Row[]): Row[] =>
    rows.toSorted((left, right) => left.name.localeCompare(right.name));

export type Chapter = `docs/${string}.md`;

export const readAt = (row: { name: string }, chapter: Chapter): ChapterAnchor =>
    `${chapter}#${row.name}`;

export function lessonsAt(
    docs: Taught & { name: string },
    messages: Readonly<Record<string, Teaching>>,
    chapter: Chapter,
): Record<string, string> {
    return lessonsOf(docs, readAt(docs, chapter), messages);
}

export type RuleOptions = {
    defaultOptions?: readonly unknown[];
    fixable?: 'code' | 'whitespace';
    schema?: readonly unknown[];
};

export type RuleDefinition<Docs extends Taught> = RuleOptions & {
    docs: Docs;
    messages: Readonly<Record<string, Teaching>>;
    read: ChapterAnchor;
    type?: RuleType;
};

export type RuleMeta<Docs> = RuleOptions & {
    docs: Docs;
    messages: Record<string, string>;
    type: RuleType;
};

export type RuleBody =
    | { create: (context: never) => object }
    | { createOnce: (context: never) => object };

export type DefinedRule<Docs, Body> = Body & { meta: RuleMeta<Docs> };

export function defineRule<Docs extends Taught, Body extends RuleBody>(
    definition: RuleDefinition<Docs>,
    body: Body,
): DefinedRule<Docs, Body> {
    const { defaultOptions, docs, fixable, messages, read, schema, type = 'problem' } = definition;

    return {
        ...body,
        meta: {
            ...(defaultOptions === undefined ? {} : { defaultOptions }),
            docs,
            ...(fixable === undefined ? {} : { fixable }),
            messages: lessonsOf(docs, read, messages),
            ...(schema === undefined ? {} : { schema }),
            type,
        },
    };
}

export type Located = { column?: number; line?: number; path: string };

export type CheckDefinition<Docs extends Taught> = {
    docs: Docs;
    namespace: string;
    read: ChapterAnchor;
};

export type DefinedCheck<Docs> = {
    docs: Docs;
    finding: (at: Located, teaching: Teaching) => Finding;
    rule: string;
};

export function defineCheck<Docs extends Taught & { name: string }>(
    definition: CheckDefinition<Docs>,
): DefinedCheck<Docs> {
    const { docs, namespace, read } = definition;
    const rule = `${namespace}/${docs.name}`;

    return {
        docs,
        finding: (at, teaching) => ({ ...at, message: lessonOf(docs, read, teaching), rule }),
        rule,
    };
}
