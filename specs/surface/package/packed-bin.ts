import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { stripVTControlCharacters } from 'node:util';

import { packedFiles } from './packed-tree.js';

const HEADER = /^ RUN (?<label>.+)$/gmu;

export type Outcome = { passes: string[]; status: number };

export async function checkOutcome(
    bin: string,
    project: string,
    env: Record<string, string>,
    args: string[] = [],
): Promise<Outcome> {
    const base = { ...process.env };
    delete base.BASH_ENV;
    delete base.TYPESCRIPT_CHECK_PASSES;
    const child = spawn('bash', [bin, 'check', ...args], {
        cwd: project,
        env: { ...base, ...env },
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    const closed: Promise<unknown[]> = once(child, 'close');
    const [printed, [code]] = await Promise.all([text(child.stdout), closed]);
    const shown = stripVTControlCharacters(printed);

    return {
        passes: [...shown.matchAll(HEADER)].map((match) => match.groups?.label?.trim() ?? ''),
        status: typeof code === 'number' ? code : -1,
    };
}

// As this machine's bash spells the exported-function variable.
function exportedSelection(): Record<string, string> {
    const exported = spawnSync(
        'bash',
        ['-c', 'selected() { [ "$1" = secrets ]; }; export -f selected; env -0'],
        { encoding: 'utf8', env: {} },
    );
    const entry = exported.stdout
        .split('\0')
        .find((line) => line.includes('selected') && line.includes('secrets'));
    const at = entry?.indexOf('=') ?? -1;

    return entry === undefined || at === -1 ? {} : { [entry.slice(0, at)]: entry.slice(at + 1) };
}

const LOCATION = new Set(['HOME', 'INIT_CWD', 'PATH', 'PWD']);

function packedScripts(tree: string): string {
    return packedFiles(tree)
        .filter((path) => path.endsWith('.sh'))
        .map((path) => readFileSync(join(tree, path), 'utf8'))
        .join('\n');
}

// An `export` or a `declare` with no `=` keeps the inherited value, so it sets nothing.
const ASSIGNS =
    /\blocal(?:\s+-[a-zA-Z]+)*\s+(?<local>[A-Za-z_]\w*)|\bfor\s+(?<loop>[A-Za-z_]\w*)\s+in\b|\bread(?:\s+-[a-zA-Z]+(?:\s+'[^']*'|\s+"[^"]*")?)*(?<reads>(?:\s+[A-Za-z_]\w*)+)|(?:^|[\s;&|(])(?<assigned>[A-Za-z_]\w*)(?:\[[^\]]*\])?\+?=/gmu;

function environmentInputs(tree: string): string[] {
    const scripts = packedScripts(tree);
    const read = new Set(
        [...scripts.matchAll(/\$\{?(?<name>[A-Za-z_]\w*)/gu)].map(
            (match) => match.groups?.name ?? '',
        ),
    );
    const set = new Set(
        [...scripts.matchAll(ASSIGNS)].flatMap(({ groups = {} }) =>
            [groups.local ?? '', groups.loop ?? '', groups.assigned ?? ''].concat(
                (groups.reads ?? '').trim().split(/\s+/u),
            ),
        ),
    );

    return [...read].filter((name) => !set.has(name) && !LOCATION.has(name));
}

export function argvFlags(tree: string): string[] {
    const arms = [...packedScripts(tree).matchAll(/^\s*(?<arm>-[-\w|]*)\)/gmu)];

    return [...new Set(arms.flatMap((match) => (match.groups?.arm ?? '').split('|')))].filter(
        (flag) => flag.startsWith('-'),
    );
}

// A `selected` bash inherits, one `BASH_ENV` defines, the specs' own selection, and every variable read and never set.
export function selectingEnvironments(
    tree: string,
    project: string,
): Record<string, Record<string, string>> {
    const sourced = join(project, 'bash-env.sh');
    writeFileSync(sourced, 'selected() { return 1; }\n');
    const inherited = exportedSelection();
    if (Object.keys(inherited).length !== 1) {
        throw new Error('bash exported no function to inherit');
    }

    return {
        'a `selected` bash inherits': inherited,
        'a `selected` the file BASH_ENV names defines': { BASH_ENV: sourced },
        'every variable the scripts read and never set, naming a pass': Object.fromEntries(
            environmentInputs(tree).map((name) => [name, 'secrets']),
        ),
        "the specs' selection": { TYPESCRIPT_CHECK_PASSES: 'secrets' },
    };
}
