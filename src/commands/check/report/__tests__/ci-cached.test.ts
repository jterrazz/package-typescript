import { describe, expect, test, vi } from 'vitest';

import { cachedRowsOf, cachedTimeOf, ciCachedPrinted, shortTimeOf } from '../ci-cached.js';

const NOW = new Date('2026-10-28T23:00:00.000Z');

function printed(work: () => void): string {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    work();
    const text = write.mock.calls.map(([chunk]) => String(chunk)).join('');
    vi.restoreAllMocks();

    return text;
}

describe('ci-cached', () => {
    test("shortTimeOf, cachedTimeOf — the proof's UTC minute, its day too when it is not today's, and the run that took it", () => {
        // Given - a proof taken today, one taken the day before, with a run and without
        // Then - today's proof by its minute, an older one by its day as well, and the run where one took it
        expect(shortTimeOf('2026-10-28T22:16:51.756Z', NOW)).toBe('22:16 UTC');
        expect(shortTimeOf('2026-10-27T07:05:00.000Z', NOW)).toBe('2026-10-27 07:05 UTC');
        expect(cachedTimeOf('2026-10-28T22:16:51.756Z', '40778644382', NOW)).toBe(
            'cached · 22:16 UTC · run 40778644382',
        );
        expect(cachedTimeOf('2026-10-28T22:16:51.756Z', null, NOW)).toBe('cached · 22:16 UTC');
    });

    test("cachedRowsOf — each pass the proof's verdict names, cached; the stage alone where it names none", () => {
        // Given - a verdict of two passes and a malformed entry, and stages whose proof holds no passes
        const at = '2026-10-28T22:16:51.756Z';
        const verdictPasses = [
            { label: 'TypeScript Check' },
            null,
            { label: 3 },
            { label: 'Config (one file)' },
        ];

        // Then - the named passes, or the stage's own name
        expect(
            cachedRowsOf({ at, passes: verdictPasses, run: '7', stage: 'check' }, NOW),
        ).toStrictEqual(
            ['types', 'config'].map((name) => ({
                findings: [],
                name,
                status: 0,
                time: 'cached · 22:16 UTC · run 7',
            })),
        );
        expect(
            [
                cachedRowsOf({ at, passes: undefined, run: null, stage: 'test' }, NOW),
                cachedRowsOf({ at, passes: [], run: null, stage: 'mutation' }, NOW),
                cachedRowsOf({ at, passes: 'none', run: null, stage: 'check' }, NOW),
            ].map((rows) => rows.map((row) => row.name)),
        ).toStrictEqual([['tests'], ['mutation'], ['check']]);
    });

    test('ciCachedPrinted — a hit is the stage proven green, a cached line per pass, then the end of a run', () => {
        // Given - a proof of two passes, taken by run 4077
        const proof = {
            at: '2026-10-28T22:16:51.756Z',
            passes: [{ label: 'TypeScript Check' }, { label: 'Config (one file)' }],
            run: '4077',
            stage: 'check',
        };

        // When - it is printed on a runner that names no summary
        const text = printed(() => {
            ciCachedPrinted(proof, '/p', {}, NOW);
        });

        // Then - no host, no checkout, no full timestamp: the passes cached by that run
        expect(text).toBe(
            [
                '▸ typescript check, proven green',
                'types         ✓ cached · 22:16 UTC · run 4077',
                'config        ✓ cached · 22:16 UTC · run 4077',
                '\u001B[0;32m✓ 2 passes, all green\u001B[0m',
                '',
            ].join('\n'),
        );
    });
});
