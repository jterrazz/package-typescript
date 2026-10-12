import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterAll, describe, expect, onTestFinished, test } from 'vitest';

import { PROFILES } from '../../../lint/consumer/rulebook/profiles.js';
import { decisions } from '../../../lint/kit/catalogue/decisions.js';
import { fragmentsIn, walkModules } from '../../../lint/kit/testing/module-walk.js';
import { isRecord, pack } from '../../__setup__/packed/pack.js';
import {
    argvFlags,
    checkOutcome,
    loadPacked,
    packedFiles,
    packedTree,
    publishedBins,
    publishedTargets,
    removePackedTree,
    selectingEnvironments,
} from './__setup__/packed-tree.js';

afterAll(removePackedTree);

// invariant: judged on content, never on names: no text the tarball holds names a `self` rule, whatever file carries it.

const ROOT = resolve(import.meta.dirname, '../../..');

const PROFILE_NAMES = Object.keys(PROFILES);

function fieldText(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    return typeof value === 'string' ? value : '';
}

const rows = ['lint/consumer/catalogue/manifest.json', 'lint/self/catalogue/manifest.json'].flatMap(
    (path) => {
        const parsed: unknown = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
        return (Array.isArray(parsed) ? parsed : []).filter((row) => isRecord(row));
    },
);

function scopeOf(block: Record<string, unknown>): string {
    const globs = (key: string): string[] => {
        const listed: unknown = block[key];

        return Array.isArray(listed) ? listed.map(String) : [];
    };

    return [...globs('files'), ...globs('excludeFiles').map((glob) => `!${glob}`)].join(',');
}

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
                scope: scopeOf(block),
            })),
    ];

    return blocks.flatMap(({ rules, scope }) =>
        Object.entries(rules).map(([rule, value]) => ({ rule, scope, value })),
    );
}

function undecided(
    name: string,
    config: unknown,
    entries: readonly Record<string, unknown>[],
): string[] {
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

describe('tarball', () => {
    test('the tarball carries no test file', () => {
        // Given - every path npm would publish
        const { paths } = pack('--dry-run');
        expect(paths).toContain('dist/oxlint.js');

        // Then - no meta-test, no module test and no spec ships, whatever its extension
        expect(
            paths.filter((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$|^specs\//u.test(path)),
        ).toStrictEqual([]);
    });

    test('every entry the tarball publishes reaches consumer fragments alone', async () => {
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

        // Then - every fragment each one reaches serves a consumer
        expect(
            loaded.flatMap(({ path, value }) =>
                fragmentsIn(value, path)
                    .filter(({ fragment }) => fragment.audience !== 'consumer')
                    .map(({ path: where }) => where),
            ),
        ).toStrictEqual([]);
    });

    test('every rule a packed profile states is a consumer decision the catalogue holds for it', async () => {
        // Given - the six profiles as the packed rulebook compiles them, and the catalogue they are compiled from
        const tree = packedTree();
        const rulebook = await loadPacked(tree, 'dist/rulebook.js');
        const profiles = isRecord(rulebook.PROFILE_CONFIGS) ? rulebook.PROFILE_CONFIGS : {};
        const entries: readonly Record<string, unknown>[] = decisions(PROFILES);

        // Then - each rule stated, at the top or in an override, is decided so for that profile
        expect(
            PROFILE_NAMES.filter((name) => statedRules(profiles[name]).length <= 100),
        ).toStrictEqual([]);
        expect(
            PROFILE_NAMES.flatMap((name) => undecided(name, profiles[name], entries)),
        ).toStrictEqual([]);
    });

    test('the passes the packed command runs are consumer alone', async () => {
        // Given - the passes the packed command selects by name
        const tree = packedTree();
        const command = await loadPacked(tree, 'dist/command.js');
        const passes: unknown[] = Array.isArray(command.CHECK_PASSES) ? command.CHECK_PASSES : [];
        expect(passes.length).toBeGreaterThan(10);

        // Then - each is a consumer row of the manifest
        expect(
            passes.filter(
                (pass) =>
                    rows.find(
                        (candidate) => candidate.channel === 'checker' && candidate.id === pass,
                    )?.audience !== 'consumer',
            ),
        ).toStrictEqual([]);
    });

    test('every module the packed tree holds reaches consumer fragments alone, whatever it does when imported', async () => {
        // Given - every module the tarball holds, and every command its bin installs that the next test does not run, each imported in a child of its own
        const tree = packedTree();
        const modules = [
            ...new Set([
                ...packedFiles(tree).filter((path) => /\.[cm]?js$/u.test(path)),
                ...publishedBins(tree),
            ]),
        ];
        const { fragments, walked } = await walkModules(tree, modules);

        // Then - every module was walked, some built fragments, and none of them is the package's own discipline
        expect(walked.toSorted()).toStrictEqual(modules.toSorted());
        expect(modules.length).toBeGreaterThan(50);
        const built = new Set(
            fragments.filter(({ path }) => path.endsWith('(built on import)')).map(({ id }) => id),
        );
        const rulebook = Object.values(PROFILES).flatMap(({ fragments: carried }) =>
            carried.map(({ id }) => id),
        );
        expect(rulebook.filter((id) => !built.has(id))).toStrictEqual([]);
        expect(
            fragments
                .filter(({ audience }) => audience !== 'consumer')
                .map(({ id, path }) => `${path} reaches ${String(id)}`),
        ).toStrictEqual([]);
    });

    test('every command the tarball installs runs every pass, whatever its environment holds', async () => {
        // Given - each bin, run where no pass applies: bare, then under every way an environment could choose its passes, then handed each flag the command spells, naming a pass
        const tree = packedTree();
        const project = mkdtempSync(join(tmpdir(), 'tarball-bin-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        const variants = [
            ...Object.entries(selectingEnvironments(tree)).map(([name, env]) => ({
                args: [],
                env,
                name,
            })),
            ...argvFlags(tree).map((flag) => ({ args: [flag, 'secrets'], env: {}, name: flag })),
        ];
        expect(variants.map(({ name }) => name)).toContain('--json');
        const bins = publishedBins(tree);
        expect(bins.length).toBeGreaterThan(0);
        const outcomes = await Promise.all(
            bins.map(async (bin) => ({
                bare: await checkOutcome(join(tree, bin), project, {}),
                bin,
                runs: await Promise.all(
                    variants.map(async ({ args, env, name }) => ({
                        name,
                        outcome: await checkOutcome(join(tree, bin), project, env, args),
                    })),
                ),
            })),
        );

        // Then - the bare run reports the passes a bare tree runs, and every other run the same passes to the same verdict, or none when the command refuses the line or prints its help
        expect(outcomes.length).toBeGreaterThan(0);
        expect(
            outcomes.flatMap(({ bare, bin, runs }) =>
                [
                    bare.passes.includes('Secrets (credentials)') && bare.passes.length > 5
                        ? null
                        : `${bin} runs too few passes bare: ${bare.passes.join(', ')}`,
                ]
                    .filter((broken) => broken !== null)
                    .concat(
                        runs
                            .filter(
                                ({ outcome }) =>
                                    outcome.passes.length > 0 &&
                                    JSON.stringify(outcome) !== JSON.stringify(bare),
                            )
                            .map(({ name }) => `${bin} under ${name}`),
                    ),
            ),
        ).toStrictEqual([]);
    });

    test('no text the tarball holds names a self rule', () => {
        // Given - every id, name and home the manifest holds self, and every file the tarball holds
        const tree = packedTree();
        const tokens = rows
            .flatMap((row) =>
                row.audience === 'self'
                    ? [fieldText(row, 'id'), basename(fieldText(row, 'home'))].concat(
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
});
