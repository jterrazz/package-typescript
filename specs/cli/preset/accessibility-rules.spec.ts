import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../__setup__/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

const REACT_CONFIG = profilePath('react');

describe('accessibility-rules', () => {
    test('an unlabelled section taking the focus and a role set through createElement are each refused with their lesson', async () => {
        // Given - a scrolling section with no label, and a polymorphic region built with createElement
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/accessibility-rules/'))
            .exec(`-c ${REACT_CONFIG} region.tsx`);

        // Then - each finding states what it found, why, how to fix it, and where to read
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('jterrazz-typescript(')).toMatch(`
            region.tsx:5:9: error jterrazz-typescript(focusable-section-is-labelled): found: a \`<section>\` that takes the keyboard’s focus and names no region · why: a \`<section>\` is a region only when it is labelled; the rulebook lets a section take \`tabIndex={0}\` so a scrolling region is reachable by the keyboard, and an unlabelled one is a stray tab stop a screen reader announces as nothing · fix: name the region it scrolls with \`aria-label\` or \`aria-labelledby\`, or drop its \`tabIndex\` · read: docs/reference/lint-presets.md#a-focusable-section-is-labelled
            region.tsx:12:32: error jterrazz-typescript(accessible-element-is-jsx): found: \`role\` set through \`createElement\`, where jsx-a11y cannot read it · why: jsx-a11y reads the props of a JSX element and never the object handed to \`createElement\`, so a role, a tab stop or an aria attribute set there escapes every accessibility rule, and an exception to them hides from the Suppressions pass and the drift report · fix: write the element in JSX — one branch per tag when it is polymorphic — so jsx-a11y reads its props, and state any exception as a reasoned \`oxlint-disable-next-line\` the Suppressions pass counts · read: docs/reference/lint-presets.md#an-accessible-element-is-written-in-jsx
        `);
    });
});
