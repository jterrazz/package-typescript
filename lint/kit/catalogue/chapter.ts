import { readFileSync, writeFileSync } from 'node:fs';

import { refusal } from './lesson.js';

export type Markers = { end: string; start: string };

export type Projection = { markers: Markers; page: string; render: () => string };

export const generatedMarkers = (name: string): Markers => ({
    end: `<!-- /GENERATED:${name} -->`,
    start: `<!-- GENERATED:${name} -->`,
});

export function spliceBetween(
    existing: string,
    markers: Markers,
    body: string,
    page: string,
): string {
    const start = existing.indexOf(markers.start);
    const end = existing.indexOf(markers.end);
    if (start === -1 || end < start) {
        throw new Error(
            refusal({
                fix: `put \`${markers.start}\` and \`${markers.end}\` back around the generated block, then regenerate`,
                found: `${page} has lost its markers (${markers.start} … ${markers.end})`,
                read: 'docs/10-rules-kit.md#a-chapter-carries-its-catalogue',
                why: 'a generated block is written between its markers, and a page without them has nowhere to receive it',
            }),
        );
    }

    return `${existing.slice(0, start)}${markers.start}\n\n${body}\n\n${existing.slice(end)}`;
}

export function projected(
    existing: string,
    page: string,
    projections: readonly Projection[],
): string {
    let text = existing;
    for (const { markers, render } of projections.filter(
        (projection) => projection.page === page,
    )) {
        text = spliceBetween(text, markers, render(), page);
    }

    return text;
}

export function writeProjections(projections: readonly Projection[]): string[] {
    const written: string[] = [];
    for (const page of new Set(projections.map((projection) => projection.page))) {
        const existing = readFileSync(page, 'utf8');
        const next = projected(existing, page, projections);
        if (next !== existing) {
            writeFileSync(page, next);
            written.push(page);
        }
    }

    return written;
}

function slugOf(heading: string): string {
    return heading
        .toLowerCase()
        .replaceAll(/[^\s\w-]/gu, '')
        .replaceAll(/\s/gu, '-');
}

export function anchorsOf(text: string): Set<string> {
    const found = new Set<string>();
    for (const line of text.split('\n')) {
        if (/^#{1,6}\s+\S/u.test(line)) {
            // Stryker disable next-line Regex: the test above found the marker at the start, where an unanchored pattern meets it first
            found.add(slugOf(line.replace(/^#{1,6}\s+/u, '').trimEnd()));
        }
        for (const [anchor] of line.matchAll(/<a id="[^"]+"><\/a>/gu)) {
            found.add(anchor.slice('<a id="'.length, -'"></a>'.length));
        }
    }

    return found;
}
