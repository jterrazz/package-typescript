import { readText } from '../project/project-files.js';

const CATALOGUE = /^lint\/(?:consumer|self)\/catalogue\/[^/]+\.(?:[cm]?[jt]s|json)$/u;

const TOKEN =
    /[{}]|["']?(?<key>id|name|family)["']?\s*:\s*(?<quote>["'`])(?<value>[^"'`\n]+)\k<quote>/gu;

const nameOf = (id) => id.split('/').at(-1);

function rowsOf(text) {
    const rows = [];
    const open = [];
    for (const { 0: token, groups } of text.matchAll(TOKEN)) {
        if (token === '{') {
            open.push({ names: [] });
        } else if (token === '}') {
            rows.push(open.pop());
        } else {
            const row = open.at(-1) ?? { names: [] };
            if (groups.key === 'family') {
                row.family = groups.value;
            } else {
                row.names.push(nameOf(groups.value));
            }
        }
    }

    return rows.filter((row) => row?.family !== undefined);
}

export function catalogueFamilies(unit, files) {
    const families = new Map();
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
