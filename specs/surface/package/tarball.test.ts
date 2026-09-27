import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import hexagonalFragment from '../../../lint/consumer/rulebook/hexagonal.js';
import { PROFILES } from '../../../lint/consumer/rulebook/profiles.js';
import { decisions } from '../../../lint/engine/catalogue/decisions.js';
import { compile } from '../../../lint/engine/compiler/compile.js';
import { fragmentsIn, walkModules } from '../../../lint/engine/testing/module-walk.js';
import {
    argvFlags,
    checkOutcome,
    isRecord,
    loadPacked,
    pack,
    packedFiles,
    packedTree,
    publishedBins,
    publishedTargets,
    selectingEnvironments,
} from './_setup/packed-tree.js';

// Judged on content, never on names: no text the tarball holds names a `self` rule, whatever file carries it.

const ROOT = resolve(import.meta.dirname, '../../..');

const PROFILE_NAMES = ['astro', 'bun', 'expo', 'next', 'node', 'react'];

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
        // Given - the six profiles, as both packed entries hand them out, and the catalogue they are compiled from
        const tree = packedTree();
        const oxlint = await loadPacked(tree, 'dist/oxlint.js');
        const index = await loadPacked(tree, 'dist/index.js');
        const entries: readonly Record<string, unknown>[] = decisions(PROFILES);
        const bundled = isRecord(index.oxlint) ? index.oxlint : {};

        // Then - each rule stated, at the top or in an override, is decided so for that profile
        for (const name of PROFILE_NAMES) {
            for (const config of [oxlint[name], bundled[name]]) {
                expect(statedRules(config).length, `${name} states no rule`).toBeGreaterThan(100);
                expect(undecided(name, config, entries)).toStrictEqual([]);
            }
        }

        // Then - the hexagonal map is its consumer fragment, compiled
        expect(hexagonalFragment.audience).toBe('consumer');
        expect(oxlint.hexagonal).toStrictEqual(compile(hexagonalFragment));
        expect(bundled.hexagonal).toStrictEqual(oxlint.hexagonal);
    });

    test('the passes the packed command runs are consumer alone', async () => {
        // Given - the passes the packed command selects by name
        const tree = packedTree();
        const command = await loadPacked(tree, 'dist/command.js');
        const passes: unknown[] = Array.isArray(command.CHECK_PASSES) ? command.CHECK_PASSES : [];
        expect(passes.length).toBeGreaterThan(10);

        // Then - each is a consumer row of the manifest
        for (const pass of passes) {
            const row = rows.find(
                (candidate) => candidate.channel === 'checker' && candidate.id === pass,
            );
            expect.soft(row?.audience, `${String(pass)} is not a consumer pass`).toBe('consumer');
        }
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
        for (const { audience, id, path } of fragments) {
            expect
                .soft(audience, `${path} reaches ${String(id)}, which is not consumer`)
                .toBe('consumer');
        }
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

        // Then - the bare run reports the passes a bare tree runs, and every other run the same passes, to the same verdict
        for (const { bare, bin, runs } of outcomes) {
            expect(bare.passes).toContain('Secrets (credentials)');
            expect(bare.passes.length).toBeGreaterThan(5);
            for (const { name, outcome } of runs) {
                expect.soft(outcome, `${bin} under ${name}`).toStrictEqual(bare);
            }
        }
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
