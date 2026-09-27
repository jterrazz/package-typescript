export function markdownTable(
    headings: readonly string[],
    rows: readonly (readonly string[])[],
): string {
    return [
        `| ${headings.join(' | ')} |`,
        `| ${headings.map(() => '---').join(' | ')} |`,
        ...rows.map((cells) => `| ${cells.join(' | ')} |`),
    ].join('\n');
}
