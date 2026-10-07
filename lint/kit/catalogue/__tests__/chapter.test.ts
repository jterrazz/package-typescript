import { describe, expect, test } from 'vitest';

import { anchorsOf } from '../chapter.js';

describe('chapter', () => {
    test('answers each heading as the link slugs it, and each row id, and nothing else', () => {
        // Given - a heading with code and punctuation, a catalogue row, a heading padded with spaces, and hashes that open no heading
        const chapter = [
            '## `intercept()` — the same double, with no chain',
            '| <a id="one-verb-per-meaning"></a>`one-verb-per-meaning` |',
            '###   Spaced  out   ',
            '#hashtag, no heading',
            'a line naming ## no heading',
        ].join('\n');

        // Then - the slug drops what a link drops, the row keeps its id, and a hash that opens no heading is none
        expect([...anchorsOf(chapter)]).toStrictEqual([
            'intercept--the-same-double-with-no-chain',
            'one-verb-per-meaning',
            'spaced--out',
        ]);
    });
});
