export type Lesson = {
    fix: string;
    found: string;
    read: `docs/${string}.md#${string}`;
    why: string;
};

export const LESSON_PARTS = ['found', 'why', 'fix', 'read'] as const;

export function refusal(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join(' · ');
}

export function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function invariant(broken: string): Error {
    return new Error(
        `@jterrazz/typescript broke one of its own invariants — a bug of the toolchain, not of the project: ${broken}`,
    );
}
