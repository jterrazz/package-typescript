export type ChapterAnchor = `docs/${string}.md#${string}`;

export type Lesson = {
    fix: string;
    found: string;
    read: ChapterAnchor;
    why: string;
};

export type Teaching = Pick<Lesson, 'fix' | 'found'>;

export type Unread = Omit<Lesson, 'read'>;

export const LESSON_PARTS = ['found', 'why', 'fix', 'read'] as const;

export const LESSON_SEPARATOR = ' · ';

export function refusal(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join(LESSON_SEPARATOR);
}

export const refusalReading = (read: ChapterAnchor, lesson: Unread): string =>
    refusal({ ...lesson, read });

export function refusalBlock(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join('\n');
}

const PART_START = /(?:^|\n| · )(?<part>found|why|fix|read): /gu;

type Part = (typeof LESSON_PARTS)[number];

const isPart = (name: string): name is Part => (LESSON_PARTS as readonly string[]).includes(name);

// invariant: a part out of order, or stated twice, makes it no lesson.
export function lessonParts(message: string): Partial<Record<Part, string>> | undefined {
    const starts = [...message.matchAll(PART_START)];
    const order = starts.map((start) => start.groups?.part ?? '');
    const expected = LESSON_PARTS.filter((part) => order.includes(part));
    if (order.join(',') !== expected.join(',') || (starts[0]?.index ?? 0) !== 0) {
        return undefined;
    }
    const parts: Partial<Record<Part, string>> = {};
    for (const [index, start] of starts.entries()) {
        const part = start.groups?.part ?? '';
        const from = start.index + start[0].length;
        const to = starts[index + 1]?.index ?? message.length;
        if (isPart(part)) {
            parts[part] = message.slice(from, to).trim();
        }
    }

    return parts;
}

export function missingParts(message: string): Part[] {
    const parts = lessonParts(message);
    if (parts === undefined) {
        return [...LESSON_PARTS];
    }

    return LESSON_PARTS.filter((part) => (parts[part] ?? '') === '');
}

export function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const ABBREVIATIONS = ['e.g', 'i.e', 'vs', 'etc'];

// invariant: never a period inside a code span (`*.spec.ts`), nor an abbreviation's.
export function firstSentence(text: string): string {
    let inCode = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === '`') {
            inCode = !inCode;
            continue;
        }
        if (inCode || (character !== '.' && character !== '!' && character !== '?')) {
            continue;
        }
        const before = text.slice(0, index);
        if (ABBREVIATIONS.some((abbreviation) => before.endsWith(abbreviation))) {
            continue;
        }
        const after = text.slice(index + 1);
        if (after === '' || /^\s+[\p{Lu}`*("'\d]/u.test(after)) {
            return text.slice(0, index + 1);
        }
    }

    return text;
}

export type Taught = { sentence: string; why?: string };

export const whyOf = (docs: Taught): string => docs.why ?? firstSentence(docs.sentence);

export function lessonOf(docs: Taught, read: ChapterAnchor, teaching: Teaching): string {
    return refusal({ ...teaching, read, why: whyOf(docs) });
}

// outside: a `{{data}}` placeholder is oxlint's, filled at report time.
export function lessonsOf(
    docs: Taught,
    read: ChapterAnchor,
    messages: Readonly<Record<string, Teaching>>,
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(messages).map(([id, teaching]) => [id, lessonOf(docs, read, teaching)]),
    );
}

export type InvariantOwner = { bugOf: string; notOf: string; package: string };

export function defineInvariant(owner: InvariantOwner): (broken: string) => Error {
    return (broken) =>
        new Error(
            `${owner.package} broke one of its own invariants — a bug of ${owner.bugOf}, not of ${owner.notOf}: ${broken}`,
        );
}

export const invariant: (broken: string) => Error = defineInvariant({
    bugOf: 'the toolchain',
    notOf: 'the project',
    package: '@jterrazz/typescript',
});
