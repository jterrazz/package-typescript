import { describe, expect, test } from 'vitest';

import { anchorsOf } from './chapter.js';

describe('chapter', () => {
    test('answers each heading as the link slugs it, and each row id', () => {
        // Given - a heading with code and punctuation, and a catalogue row
        const chapter = [
            '## `intercept()` — the same double, with no chain',
            '| <a id="one-verb-per-meaning"></a>`one-verb-per-meaning` |',
        ].join('\n');

        // Then - the slug drops what a link drops, and the row keeps its id
        expect([...anchorsOf(chapter)]).toStrictEqual([
            'intercept--the-same-double-with-no-chain',
            'one-verb-per-meaning',
        ]);
    });
});
