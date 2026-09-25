import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { AUDIENCES } from '../../../lint/_contract.js';
import { catalog } from '../../../lint/catalog.js';
import { PROFILES } from '../../../lint/profiles.js';
import { lintFragments } from './lint-fragments.js';

/*
 * Every rule this package holds declares who it is for: `consumer`, meaningful
 * in any project that uses the package, or `self`, this package's own suite
 * discipline. A rulebook fragment declares it for every decision it holds; a
 * pass of `typescript check` declares it in `src/cli/check-passes.json`.
 */

const ROOT = resolve(import.meta.dirname, '../../..');

/** Whether a value is an object whose keys can be read. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** The fragments the package declares, wherever a module of `lint/` or `src/` holds them. */
const declared = await lintFragments(ROOT);
const fragments = declared.map(({ fragment, path }) => ({
    audience: fragment.audience,
    path,
}));

/** The registry of `typescript check`'s passes, one row per pass. */
const registry: unknown = JSON.parse(readFileSync(join(ROOT, 'src/cli/check-passes.json'), 'utf8'));
const passes = (Array.isArray(registry) ? registry : []).map((row: unknown) => ({
    audience: isRecord(row) ? row.audience : undefined,
    pass: isRecord(row) && typeof row.pass === 'string' ? row.pass : '',
}));

/** Two names in their alphabetical order. */
function byName(left: string | undefined, right: string | undefined): number {
    return (left ?? '').localeCompare(right ?? '');
}

test('every fragment of the rulebook declares its audience', () => {
    // Given - every fragment a module of lint/ or src/ holds, whether a profile carries it or not
    expect(fragments.length).toBeGreaterThan(15);

    // Then - each one names an audience of the closed pair
    for (const { audience, path } of fragments) {
        expect.soft(AUDIENCES, `${path} declares no audience`).toContain(audience);
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

test('every pass of the check declares its audience', () => {
    // Given - the registry of the check's passes
    // Then - each row names an audience of the closed pair
    for (const { audience, pass } of passes) {
        expect.soft(AUDIENCES, `${pass} declares no audience`).toContain(audience);
    }
});

test('the registry holds exactly the passes the check selects by name', () => {
    // Given - every pass the check script asks the selector about
    const script = readFileSync(join(ROOT, 'bin/commands/check.sh'), 'utf8');
    const selected = new Set(
        [...script.matchAll(/\bselected (?<pass>[a-z]+)/gu)].map((match) => match.groups?.pass),
    );

    // Then - the registry names each one, and nothing else
    expect(passes.map(({ pass }) => pass).toSorted(byName)).toStrictEqual(
        [...selected].toSorted(byName),
    );
});
