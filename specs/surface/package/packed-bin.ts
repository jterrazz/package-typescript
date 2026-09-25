import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { stripVTControlCharacters } from 'node:util';

import { packedFiles } from './packed-tree.js';

/*
 * A packed shell command's `check`, run and read: the passes it reported and
 * how it ended, and every environment that could try to choose them.
 */

/** A pass header, its colours stripped: the label after `RUN`. */
const HEADER = /^ RUN (?<label>.+)$/gmu;

/** What a run of the check showed: every pass it reported, and its exit code. */
export type Outcome = { passes: string[]; status: number };

/** `bin check`, then `args`, run in `project`, in an environment of `env` over the process's own, any selection of its own left out. */
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

/** The variable bash exports a function named `selected` in, as this machine's bash spells it. */
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

/** The variables that say where the project and the shell are, which a run is right to follow. */
const LOCATION = new Set(['HOME', 'INIT_CWD', 'PATH', 'PWD']);

/** Every packed shell script's text, one after the other. */
function packedScripts(tree: string): string {
    return packedFiles(tree)
        .filter((path) => path.endsWith('.sh'))
        .map((path) => readFileSync(join(tree, path), 'utf8'))
        .join('\n');
}

/**
 * What a shell script gives a variable its value by: an assignment, `name=`
 * or `name+=` or `name[i]=`; a `local`, which shadows what bash inherited; a
 * `for` loop's name; and every name a `read` fills. An `export` or a
 * `declare` with no `=` keeps the inherited value, so it sets nothing.
 */
const ASSIGNS =
    /\blocal(?:\s+-[a-zA-Z]+)*\s+(?<local>[A-Za-z_]\w*)|\bfor\s+(?<loop>[A-Za-z_]\w*)\s+in\b|\bread(?:\s+-[a-zA-Z]+(?:\s+'[^']*'|\s+"[^"]*")?)*(?<reads>(?:\s+[A-Za-z_]\w*)+)|(?:^|[\s;&|(])(?<assigned>[A-Za-z_]\w*)(?:\[[^\]]*\])?\+?=/gmu;

/** Every environment variable the packed shell scripts read and never set, of any case, the location ones left out. */
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

/** Every flag a `case` arm of the packed shell scripts matches, `--json)` or `-h|--help)`. */
export function argvFlags(tree: string): string[] {
    const arms = [...packedScripts(tree).matchAll(/^\s*(?<arm>-[-\w|]*)\)/gmu)];

    return [...new Set(arms.flatMap((match) => (match.groups?.arm ?? '').split('|')))].filter(
        (flag) => flag.startsWith('-'),
    );
}

/**
 * Every environment that could try to choose which passes a packed check
 * runs, by name: a `selected` bash inherits, one the file `BASH_ENV` names
 * defines (written beside `project`), the specs' own selection, and every
 * variable the scripts read and never set, each naming a pass.
 */
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
