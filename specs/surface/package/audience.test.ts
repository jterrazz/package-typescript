import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { AUDIENCES } from '../../../lint/_contract.js';
import { catalog } from '../../../lint/catalog.js';
import { PROFILES } from '../../../lint/profiles.js';
import { lintFragments } from './lint-fragments.js';

// A `self` row names the home that holds it — a path the package leaves out — and the names the tarball audit greps for.

const ROOT = resolve(import.meta.dirname, '../../..');

const CHANNELS = ['checker', 'meta', 'runtime'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function fieldText(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    return typeof value === 'string' ? value : '';
}

const declared = await lintFragments(ROOT);

const parsed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'specs/surface/package/rules.json'), 'utf8'),
);
const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => isRecord(row));

function rowsOf(channel: string, audience: string): Record<string, unknown>[] {
    return rows.filter((row) => row.channel === channel && row.audience === audience);
}

function byName(left: string, right: string): number {
    return left.localeCompare(right);
}

function shippedModules(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return shippedModules(path);
        }
        return /\.(?:[cm]?js|sh)$/u.test(entry.name) ? [relative(ROOT, path)] : [];
    });
}

// An exit with anything but a literal 0 counts, a variable's value included.
const REFUSALS: Record<string, { script: RegExp; module: RegExp }> = {
    exit: { module: /\bexit\((?!0\))/gu, script: /(?<![\w-])exit\s+(?:[1-9]|"?\$)/gu },
    reject: { module: /\breject\(/gu, script: /$^/gu },
    throw: { module: /\bthrow\s+(?:new\s+)?[\w$.]+\(/gu, script: /$^/gu },
};

test('every fragment of the rulebook declares its audience', () => {
    // Given - every fragment a module of lint/ or src/ holds, whether a profile carries it or not
    expect(declared.length).toBeGreaterThan(15);

    // Then - each one names an audience of the closed pair
    for (const { fragment, path } of declared) {
        expect.soft(AUDIENCES, `${path} declares no audience`).toContain(fragment.audience);
    }
});

test('every profile carries consumer fragments alone', () => {
    // Given - the fragments each shipped profile is compiled from
    // Then - none is the package's own discipline
    for (const [name, profile] of Object.entries(PROFILES)) {
        for (const fragment of profile.fragments) {
            expect.soft(fragment.audience, `${name} carries ${fragment.id}`).toBe('consumer');
        }
    }
});

test('every catalogue entry carries the audience its fragment declared', () => {
    // Given - the catalogue, every decision of every profile
    // Then - each entry says who it is for
    for (const entry of catalog()) {
        expect.soft(AUDIENCES, `${entry.rule} has no audience`).toContain(entry.audience);
    }
});

test('every row of the manifest declares its audience, on a channel of its own', () => {
    // Given - every rule the manifest holds
    expect(rows.length).toBeGreaterThan(20);
    const ids = rows.map((row) => fieldText(row, 'id'));

    // Then - each names an audience of the pair and a channel, under an id no other row takes
    for (const row of rows) {
        expect
            .soft(AUDIENCES, `${fieldText(row, 'id')} declares no audience`)
            .toContain(row.audience);
        expect.soft(CHANNELS, `${fieldText(row, 'id')} sits on no channel`).toContain(row.channel);
    }
    expect(ids.filter((id, index) => id === '' || ids.indexOf(id) !== index)).toStrictEqual([]);
});

test('the consumer passes are exactly the passes the check selects by name', () => {
    // Given - every pass the check script asks about
    const script = readFileSync(join(ROOT, 'bin/commands/check.sh'), 'utf8');
    const selected = new Set(
        [...script.matchAll(/\bselected (?<pass>[a-z]+)/gu)].map(
            (match) => match.groups?.pass ?? '',
        ),
    );

    // Then - the manifest's consumer checker rows name each one, and nothing else
    expect(
        rowsOf('checker', 'consumer')
            .map((row) => fieldText(row, 'id'))
            .toSorted(byName),
    ).toStrictEqual([...selected].toSorted(byName));
});

test('every refusal a shipped module makes is a consumer row, and every row is still there', () => {
    // Given - every module of lint/, src/ and bin/, and the runtime rows of the manifest
    const modules = ['lint', 'src', 'bin'].flatMap((folder) => shippedModules(join(ROOT, folder)));
    const runtime = rows.filter((row) => row.channel === 'runtime');

    // Then - a module refuses in each way as often as its rows declare, each consumer, each still worded so
    for (const module of modules) {
        const source = readFileSync(join(ROOT, module), 'utf8');
        for (const [by, { module: inModule, script }] of Object.entries(REFUSALS)) {
            const made = source.match(module.endsWith('.sh') ? script : inModule)?.length ?? 0;
            const declaredRefusals = runtime.filter(
                (row) => row.module === module && row.by === by,
            );
            expect
                .soft(
                    declaredRefusals.length,
                    `${module} refuses by ${by} where no row declares it`,
                )
                .toBe(made);
        }
    }
    for (const row of runtime) {
        const module = fieldText(row, 'module');
        expect
            .soft(Object.keys(REFUSALS), `${fieldText(row, 'id')} refuses no known way`)
            .toContain(row.by);
        expect
            .soft(row.audience, `${fieldText(row, 'id')} ships, so it is consumer`)
            .toBe('consumer');
        expect
            .soft(
                existsSync(join(ROOT, module)) && readFileSync(join(ROOT, module), 'utf8'),
                `${fieldText(row, 'id')} is no longer worded so in ${module}`,
            )
            .toContain(fieldText(row, 'message'));
    }
});

test('a refusal counts however it is spelled, and a rethrow or a clean exit does not', () => {
    // Given - each spelling of a refusal, and each of what is none
    const spellings: Record<string, { module?: string[]; none: string[]; script?: string[] }> = {
        exit: {
            module: ['exit(1);', 'process.exit(code);'],
            none: ['exit(0);', 'exit 0', 'printf "exit code %d"', '(--linter-exit "$status")'],
            script: ['exit 1', 'exit "$status"', 'exit $?'],
        },
        reject: { module: ['reject(new Error(x));', 'reject(error);', 'reject();'], none: [] },
        throw: {
            module: ['throw new TypeError(x);', 'throw Error(x);', 'throw errors.refused(x);'],
            none: ['throw error;', "'only-throw-error'"],
        },
    };

    // Then - every spelling counts once, where it is written, and nothing else counts
    for (const [by, { module: inModule, script }] of Object.entries(REFUSALS)) {
        const cases = spellings[by] ?? { none: [] };
        expect.soft(by in spellings, `${by} has no spelling proved`).toBe(true);
        for (const line of cases.module ?? []) {
            expect.soft(line.match(inModule)?.length, `${line} is no ${by}`).toBe(1);
        }
        for (const line of cases.script ?? []) {
            expect.soft(line.match(script)?.length, `${line} is no ${by}`).toBe(1);
        }
        for (const line of cases.none) {
            expect.soft(line.match(inModule) ?? line.match(script), `${line} counts`).toBeNull();
        }
    }
});

test('every self row names the home that holds it, which the package leaves out', () => {
    // Given - every path npm would publish, and the self rows of the manifest
    const run = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    const packed = run.stdout;
    const self = rows.filter((row) => row.audience === 'self');
    expect(self.length).toBeGreaterThan(0);

    // Then - each home exists here, ships nowhere, and holds every name the row greps for
    for (const row of self) {
        const home = fieldText(row, 'home');
        const names: unknown[] = Array.isArray(row.names) ? row.names : [];
        const source = existsSync(join(ROOT, home)) ? readFileSync(join(ROOT, home), 'utf8') : '';
        expect.soft(source, `${fieldText(row, 'id')} has no home`).not.toBe('');
        expect.soft(packed, `${fieldText(row, 'id')} ships its home`).not.toContain(`"${home}"`);
        expect
            .soft(fieldText(row, 'why'), `${fieldText(row, 'id')} says not why it stays home`)
            .not.toBe('');
        expect
            .soft(names.length, `${fieldText(row, 'id')} names nothing to grep for`)
            .toBeGreaterThan(0);
        for (const name of names) {
            expect.soft(source, `${basename(home)} holds no "${String(name)}"`).toContain(name);
        }
    }
});
