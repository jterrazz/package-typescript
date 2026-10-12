import { describe, expect, test } from 'vitest';

import { placementFindingOf } from '../names.placement.js';

const TREE = {
    consumer: ['catalogue', 'rulebook', 'rules', 'checks'],
    kit: ['project'],
    self: ['catalogue', 'rules', 'checks', 'corpus'],
};

describe('placementFindingOf', () => {
    test('placementFindingOf — a folder of the self tree that is no declaration folder is told where a program and its parts go', () => {
        // Given - a folder at the root of lint/self/ that none of the four names
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/self/reading' },
        );

        // Then - it names the folder, and the fix lists the folders, then says what a program at the self root composes
        expect(finding?.message).toContain('found: `lint/self/reading/` is not a folder of self/');
        expect(finding?.message).toContain(
            'fix: move its files into the folder its nature names — catalogue/, rules/, checks/, corpus/; a program at the self root composes, and the parts it tests live in corpus/, tested there',
        );
    });

    test('placementFindingOf — the same finding under consumer/ adds nothing about a program', () => {
        // Given - a folder at the root of lint/consumer/ that is none of its four
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/consumer/reading' },
        );

        // Then - the fix ends on the folders
        expect(finding?.message).toContain(
            'fix: move its files into the folder its nature names — catalogue/, rulebook/, rules/, checks/ · read:',
        );
    });

    test('placementFindingOf — a file at the root of a tree folder is a file there, and what lies deeper is left to the rest of the pass', () => {
        // Given - a file at the root of lint/self/ and a folder under a known folder of it
        const file = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: false, path: 'lint/self/notes.ts' },
        );
        const deeper = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/self/rules/unsorted' },
        );
        const deeperFile = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: false, path: 'lint/self/rules/unsorted.ts' },
        );

        // Then - the file is told it holds a file at the root; the deeper folder is no finding of this check
        expect(file?.message).toContain(
            'found: `lint/self/notes.ts` holds a file at the root of self/',
        );
        expect([deeper, deeperFile]).toStrictEqual([undefined, undefined]);
    });

    test('placementFindingOf — a tree folder that itself fails is moved as a file, not as a folder of files', () => {
        // Given - the folder lint/kit/ named alone
        const finding = placementFindingOf(
            { trees: { '': TREE }, units: [] },
            { isDirectory: true, path: 'lint/kit' },
        );

        // Then - the fix speaks of the file
        expect(finding?.message).toContain('fix: move the file into the folder');
    });
});
