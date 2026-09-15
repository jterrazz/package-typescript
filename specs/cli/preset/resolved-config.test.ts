import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { printConfig, PROFILES } from './rulebook.js';

/*
 * The resolved rule set of every profile, as a golden. An oxlint bump, or a
 * decision flipped by accident, shows as ONE line changing its marker in a diff
 * a reviewer can read. Nothing else in this repository would show a rule set
 * changing.
 *
 * Three markers, because oxlint reports three states: a bare name is on, `- `
 * is off, and `~ ` is a rule the BASE config does not decide because the
 * profile decides it inside an `overrides` block — every vitest rule, which
 * applies to test files and to nothing else.
 *
 * Names only: a rule's options are the manifest's business, and a name list
 * survives an option reshuffle upstream without going red for it. Regenerate
 * with `TEST_UPDATE=1 npm test`.
 */

const EXPECTED = resolve(import.meta.dirname, '_expected');

/** One golden per profile, named here so the file is reachable by a reader too. */
const GOLDENS: Record<string, string> = {
    astro: 'astro.rules.txt',
    bun: 'bun.rules.txt',
    expo: 'expo.rules.txt',
    library: 'library.rules.txt',
    next: 'next.rules.txt',
    node: 'node.rules.txt',
};

const MARKERS: Record<string, string> = { allow: '- ', deny: '', warn: '~ ' };

/** oxlint's own word for a level, with the rule's options dropped. */
function levelOf(entry: unknown): string {
    return Array.isArray(entry) ? String(entry[0]) : String(entry);
}

test.each(PROFILES)('$name resolves to the rule set its golden records', ({ name }) => {
    // Given - the profile, resolved by oxlint itself
    const { rules } = printConfig(name);

    // Then - the sorted roster matches the golden, marker by marker
    const report = `${Object.keys(rules)
        .toSorted((left, right) => left.localeCompare(right))
        .map((rule) => `${MARKERS[levelOf(rules[rule])] ?? '? '}${rule}`)
        .join('\n')}\n`;
    const golden = resolve(EXPECTED, GOLDENS[name] ?? '');

    if (process.env.TEST_UPDATE === '1') {
        writeFileSync(golden, report);
    }
    expect(report).toBe(readFileSync(golden, 'utf8'));
});
