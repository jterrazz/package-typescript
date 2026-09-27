import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LESSON_MODULE = 'lint/engine/catalogue/lesson.ts';

const ERROR = String.raw`(?:Aggregate|Eval|Range|Reference|Syntax|Type|URI|[A-Z][\w$]*)?Error`;

const CONSTRUCTION = new RegExp(
    String.raw`(?<new>\bnew\s+)?(?<![\w$.])(?<name>${ERROR})\s*\((?<opening>\s*refusal\()?`,
    'gu',
);

const READ = /\bread:\s*['"`](?<chapter>docs\/[^'"`#]+\.md)#(?<anchor>[^'"`]+)['"`]/gu;

export function handWrittenErrors(source: string): string[] {
    return [...source.matchAll(CONSTRUCTION)]
        .filter(({ groups }) => groups?.new === undefined || groups.opening === undefined)
        .map((match) => match[0].trim());
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

export function unreadHeadings(source: string, root: string): string[] {
    return [...source.matchAll(READ)].flatMap(({ groups }) => {
        const chapter = join(root, groups?.chapter ?? '');
        const anchor = groups?.anchor ?? '';
        const exists = existsSync(chapter) && headingsOf(readFileSync(chapter, 'utf8')).has(anchor);

        return exists ? [] : [`${groups?.chapter ?? ''}#${anchor}`];
    });
}
