import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PrintingPlugin = { meta: { name: string }; rules: Readonly<Record<string, unknown>> };

function passIdPattern(passes: readonly string[]): RegExp {
    return new RegExp(
        `(?:['"\`]|\\\\n)(?<id>(?:${passes.join('|')})\\/[a-z\\d]+(?:-[a-z\\d]+)*)(?![\\w/-])`,
        'gu',
    );
}

export function printedIds({
    checks,
    plugin,
    rows,
}: {
    checks: string;
    plugin: PrintingPlugin;
    rows: readonly { id: string }[];
}): string[] {
    const passes = [...new Set(rows.map((row) => row.id.split('/')[0] ?? ''))].filter(
        (namespace) => namespace !== plugin.meta.name,
    );
    const pattern = passIdPattern(passes);
    const fromPasses = readdirSync(checks)
        .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
        .flatMap((name) =>
            [...readFileSync(join(checks, name), 'utf8').matchAll(pattern)].map(
                (match) => match.groups?.id ?? '',
            ),
        );
    const fromRules = Object.keys(plugin.rules).map((rule) => `${plugin.meta.name}/${rule}`);

    return [...new Set([...fromPasses, ...fromRules])].toSorted();
}
