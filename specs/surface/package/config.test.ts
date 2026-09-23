import { defineConfig } from '@jterrazz/typescript/config';
import type { JterrazzConfig } from '@jterrazz/typescript/config';
import { expect, test } from 'vitest';

/*
 * A sibling package of the family adds its section the way `@jterrazz/test`
 * does: by merging into the interface this entry exports. The TypeScript Check
 * pass type-checks this file, so the augmentation below is the claim that the
 * merge reaches `defineConfig` — and the `@ts-expect-error` lines the claim
 * that a section's shape is enforced.
 */
declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- an augmentation merges into an interface only; a type alias would redeclare the name
    interface JterrazzConfig {
        sibling?: { readonly strict: boolean };
    }
}

test('returns the settings exactly as written', () => {
    // Given - one section of this package's and one a sibling merged in
    const written: JterrazzConfig = {
        sibling: { strict: true },
        typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
    };

    // Then - the value is the file's, untouched
    expect(defineConfig(written)).toBe(written);
});

test('types every section it knows, and refuses one nobody declared', () => {
    // Given - a root with no reason, and a section no package of the family declares
    const refused = [
        // @ts-expect-error — a root maps to the reason the repository keeps it
        defineConfig({ typescript: { roots: { scripts: true } } }),
        // @ts-expect-error — no package declared an `unknown` section
        defineConfig({ unknown: {} }),
    ];

    // Then - both still load: the refusal is the type checker's, not the runtime's
    expect(refused).toHaveLength(2);
});
