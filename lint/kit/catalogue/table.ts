export function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`);
}

export const anchor = (name: string): string => `<a id="${name}"></a>`;

// invariant: padded as oxfmt pads a table, so a generated chapter is format-clean; every character of a cell counts as one column.
export function markdownTable(
    headings: readonly string[],
    rows: readonly (readonly string[])[],
): string {
    const widths = headings.map((heading, index) =>
        Math.max(heading.length, 3, ...rows.map((row) => (row[index] ?? '').length)),
    );
    const line = (cells: readonly string[]): string =>
        `| ${cells.map((text, index) => text.padEnd(widths[index] ?? 0)).join(' | ')} |`;

    return [
        line(headings),
        `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
        ...rows.map((cells) => line(cells)),
    ].join('\n');
}
