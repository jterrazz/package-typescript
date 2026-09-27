import { readText } from '../project/project-files.js';

const CATALOGUE = /^lint\/(?:consumer|self)\/catalogue\/[^/]+\.(?:[cm]?[jt]s|json)$/u;

const TOKEN =
    /[{}]|["']?(?<key>id|name|family)["']?\s*:\s*(?<quote>["'`])(?<value>[^"'`\n]+)\k<quote>/gu;

type Row = { family?: string | undefined; names: string[] };

const nameOf = (id: string): string => id.split('/').at(-1) ?? id;

function rowsOf(text: string): { family: string; names: string[] }[] {
    const rows: (Row | undefined)[] = [];
    const open: Row[] = [];
    for (const { 0: token, groups } of text.matchAll(TOKEN)) {
        if (token === '{') {
            open.push({ names: [] });
        } else if (token === '}') {
            rows.push(open.pop());
        } else {
            const row = open.at(-1) ?? { names: [] };
            if (groups?.key === 'family') {
                row.family = groups.value;
            } else {
                row.names.push(nameOf(groups?.value ?? ''));
            }
        }
    }

    return rows.flatMap((row) =>
        row?.family === undefined ? [] : [{ family: row.family, names: row.names }],
    );
}

export function catalogueFamilies(unit: string, files: readonly string[]): Map<string, string> {
    const families = new Map<string, string>();
    const rows = files
        .filter((file) => CATALOGUE.test(file))
        .flatMap((path) => rowsOf(readText(unit, path) ?? ''));
    for (const { family, names } of rows) {
        for (const name of names.filter((one) => !families.has(one))) {
            families.set(name, family);
        }
    }

    return families;
}
