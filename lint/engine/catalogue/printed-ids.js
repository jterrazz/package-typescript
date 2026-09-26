import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function passIdPattern(passes) {
    return new RegExp(
        `(?:['"\`]|\\\\n)(?<id>(?:${passes.join('|')})\\/[a-z\\d]+(?:-[a-z\\d]+)*)(?![\\w/-])`,
        'gu',
    );
}

export function printedIds({ checks, plugin, rows }) {
    const passes = [...new Set(rows.map((row) => row.id.split('/')[0] ?? ''))].filter(
        (namespace) => namespace !== plugin.meta.name,
    );
    const pattern = passIdPattern(passes);
    const fromPasses = readdirSync(checks)
        .filter((name) => name.endsWith('.js'))
        .flatMap((name) =>
            [...readFileSync(join(checks, name), 'utf8').matchAll(pattern)].map(
                (match) => match.groups?.id ?? '',
            ),
        );
    const fromRules = Object.keys(plugin.rules).map((rule) => `${plugin.meta.name}/${rule}`);

    return [...new Set([...fromPasses, ...fromRules])].toSorted();
}
