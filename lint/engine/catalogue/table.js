export function markdownTable(headings, rows) {
    return [
        `| ${headings.join(' | ')} |`,
        `| ${headings.map(() => '---').join(' | ')} |`,
        ...rows.map((cells) => `| ${cells.join(' | ')} |`),
    ].join('\n');
}
