import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

import { fragmentsIn, walkModules } from './module-walk.js';
import {
    isRecord,
    loadPacked,
    pack,
    packedFiles,
    packedTree,
    publishedBins,
    publishedTargets,
} from './packed-tree.js';

/*
 * The tarball-audit rule: what npm would publish carries `consumer` rules
 * alone, judged on its content and never on its names. Loaded from the packed
 * tree itself — every entry its `exports` map publishes, every module it
 * holds, each in a child of its own, and its bin run — it reaches no
 * fragment, profile decision, pass or refusal the manifest (`rules.json`)
 * holds `self`; and no text the tarball holds names a self rule — no id, no
 * name, no home, no fragment declared `self` — whatever file carries it.
 */

const ROOT = resolve(import.meta.dirname, '../../..');

/** The profiles a consumer names. */
const PROFILE_NAMES = ['astro', 'bun', 'expo', 'next', 'node', 'react'];

/** A field of a record, as text: empty when it holds none. */
function text(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    return typeof value === 'string' ? value : '';
}

/** The manifest's rows, one per rule no module declares for itself. */
const parsed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'specs/surface/package/rules.json'), 'utf8'),
);
const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => isRecord(row));

/** A function a packed module exports, called — or nothing, when it exports none by that name. */
function call(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
    const exported = module[name];
    return typeof exported === 'function' ? Reflect.apply(exported, undefined, args) : undefined;
}

/** The packed catalogue's entries. */
function catalogueOf(catalogue: Record<string, unknown>): Record<string, unknown>[] {
    const entries = call(catalogue, 'catalog');
    return (Array.isArray(entries) ? entries : []).filter((entry) => isRecord(entry));
}

/** Every rule a compiled config states, at its top (scope '') or in an override, with its value. */
function statedRules(config: unknown): { rule: string; scope: string; value: unknown }[] {
    const top = isRecord(config) && isRecord(config.rules) ? config.rules : {};
    const overrides: unknown[] =
        isRecord(config) && Array.isArray(config.overrides) ? config.overrides : [];
    const blocks = [
        { rules: top, scope: '' },
        ...overrides
            .filter((block) => isRecord(block))
            .map((block) => ({
                rules: isRecord(block.rules) ? block.rules : {},
                scope: Array.isArray(block.files) ? block.files.join(',') : '',
            })),
    ];

    return blocks.flatMap(({ rules, scope }) =>
        Object.entries(rules).map(([rule, value]) => ({ rule, scope, value })),
    );
}

/** What a profile states that the catalogue does not hold for it, for a consumer, at that level. */
function undecided(name: string, config: unknown, entries: Record<string, unknown>[]): string[] {
    return statedRules(config).flatMap(({ rule, scope, value }) => {
        const decided = entries.filter(
            (entry) =>
                entry.rule === rule &&
                (Array.isArray(entry.scoped) ? entry.scoped.join(',') : '') === scope &&
                Array.isArray(entry.profiles) &&
                entry.profiles.includes(name) &&
                entry.audience === 'consumer',
        );
        const [level]: unknown[] = [value].flat();
        if (decided.length !== 1) {
            return [`${name} states ${rule} ${scope} with no consumer decision`];
        }
        return decided[0]?.level === level
            ? []
            : [`${name} states ${rule}${scope === '' ? '' : ` in ${scope}`} at another level`];
    });
}

test('the tarball carries no test file', () => {
    // Given - every path npm would publish
    const { paths } = pack('--dry-run');
    expect(paths).toContain('lint/_contract.js');

    // Then - no meta-test, no module test and no spec ships, whatever its extension
    expect(
        paths.filter((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$|^specs\//u.test(path)),
    ).toStrictEqual([]);
});

test('every entry the tarball publishes loads, and reaches consumer fragments alone', async () => {
    // Given - every file the packed exports map names, under every condition Node loads
    const tree = packedTree();
    const targets = publishedTargets(tree);
    expect(targets.length).toBeGreaterThan(10);
    const loaded = await Promise.all(
        targets
            .filter((path) => existsSync(join(tree, path)))
            .map(async (path) => ({
                path,
                value: path.endsWith('.json')
                    ? (JSON.parse(readFileSync(join(tree, path), 'utf8')) as unknown)
                    : await loadPacked(tree, path),
            })),
    );

    // Then - each one is there, and every fragment it reaches serves a consumer
    expect(loaded.map(({ path }) => path)).toStrictEqual(targets);
    for (const { path, value } of loaded) {
        for (const { fragment, path: where } of fragmentsIn(value, path)) {
            expect.soft(fragment.audience, `${where} is not consumer`).toBe('consumer');
        }
    }
});

test('every rule a packed profile states is a consumer decision the catalogue holds for it', async () => {
    // Given - the six profiles, as both packed entries hand them out, and the packed catalogue
    const tree = packedTree();
    const oxlint = await loadPacked(tree, 'src/oxlint.js');
    const index = await loadPacked(tree, 'src/index.js');
    const hexagonal = await loadPacked(tree, 'lint/architecture/hexagonal.js');
    const compiler = await loadPacked(tree, 'lint/compile.js');
    const entries = catalogueOf(await loadPacked(tree, 'lint/catalog.js'));
    const bundled = isRecord(index.oxlint) ? index.oxlint : {};

    // Then - each rule stated, at the top or in an override, is decided so for that profile
    for (const name of PROFILE_NAMES) {
        for (const config of [oxlint[name], bundled[name]]) {
            expect(statedRules(config).length, `${name} states no rule`).toBeGreaterThan(100);
            expect(undecided(name, config, entries)).toStrictEqual([]);
        }
    }

    // Then - the hexagonal map is its consumer fragment, compiled
    expect(isRecord(hexagonal.default) && hexagonal.default.audience).toBe('consumer');
    expect(oxlint.hexagonal).toStrictEqual(call(compiler, 'compile', hexagonal.default));
    expect(bundled.hexagonal).toStrictEqual(oxlint.hexagonal);
});

test('the catalogue and the passes the tarball ships are consumer alone', async () => {
    // Given - the packed catalogue, and the passes the packed check selects by name
    const tree = packedTree();
    const catalogue = await loadPacked(tree, 'lint/catalog.js');
    const script = readFileSync(join(tree, 'bin/commands/check.sh'), 'utf8');
    const passes = [...script.matchAll(/\bselected (?<pass>[a-z]+)/gu)].map((match) =>
        rows.find((row) => row.channel === 'checker' && row.id === match.groups?.pass),
    );

    // Then - the catalogue exposes its consumer half alone, and each pass is a consumer row
    expect(
        Object.keys(catalogue).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['catalog', 'unsafeFixers']);
    for (const [what, audiences] of Object.entries({
        'catalogue entry': catalogueOf(catalogue).map((entry) => entry.audience),
        'check pass': passes.map((row) => row?.audience),
    })) {
        expect(audiences.length, `the tarball ships no ${what}`).toBeGreaterThan(0);
        expect(new Set(audiences), `a ${what} ships that is not consumer`).toStrictEqual(
            new Set(['consumer']),
        );
    }
});

test('every module the packed tree holds reaches consumer fragments alone, whatever it does when imported', async () => {
    // Given - every module the tarball holds, and every command its bin installs that the next test does not run, each imported in a child of its own
    const tree = packedTree();
    const shellBins = new Set(publishedBins(tree).filter((path) => path.endsWith('.sh')));
    const modules = [
        ...new Set([
            ...packedFiles(tree).filter((path) => /\.[cm]?js$/u.test(path)),
            ...publishedBins(tree).filter((path) => !shellBins.has(path)),
        ]),
    ];
    const { fragments, walked } = await walkModules(tree, modules);

    // Then - every module was walked, some built fragments, and none of them is the package's own discipline
    expect(walked.toSorted()).toStrictEqual(modules.toSorted());
    expect(modules.length).toBeGreaterThan(50);
    expect(
        fragments.filter(({ path }) => path.endsWith('(built on import)')).length,
    ).toBeGreaterThan(15);
    for (const { audience, id, path } of fragments) {
        expect
            .soft(audience, `${path} reaches ${String(id)}, which is not consumer`)
            .toBe('consumer');
    }
});

test('the packed bin runs every pass, whatever a selection names', () => {
    // Given - the published command, run where no pass applies, handed a selection of no pass
    const project = mkdtempSync(join(tmpdir(), 'tarball-bin-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    const run = spawnSync('bash', [join(packedTree(), 'bin/typescript.sh'), 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, BASH_ENV: undefined, TYPESCRIPT_CHECK_PASSES: 'no-such-pass' },
    });

    // Then - nothing refuses the selection, and the passes a bare tree runs all report
    expect(run.status).not.toBe(2);
    expect(run.stdout).toContain('TypeScript Check');
    expect(run.stdout).toContain('Secrets (credentials)');
});

test('no text the tarball holds names a self rule', () => {
    // Given - every id, name and home the manifest holds self, and every file the tarball holds
    const tree = packedTree();
    const tokens = rows
        .flatMap((row) =>
            row.audience === 'self'
                ? [text(row, 'id'), basename(text(row, 'home'))].concat(
                      Array.isArray(row.names) ? row.names.map(String) : [],
                  )
                : [],
        )
        .filter((token) => token !== '');
    expect(tokens.length).toBeGreaterThan(10);
    const declaredSelf = /\baudience["']?\s*:\s*["'`]self["'`]/u;

    // Then - no file carries one, nor declares anything self
    const hits = packedFiles(tree).flatMap((path) => {
        const content = readFileSync(join(tree, path), 'utf8');
        const named = tokens.filter((token) => content.includes(token));
        const declares = declaredSelf.test(content) ? ['declares an audience of self'] : [];
        return named.concat(declares).map((hit) => `${path}: ${hit}`);
    });
    expect(hits).toStrictEqual([]);
});
