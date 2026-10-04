import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { generatedMarkers, spliceBetween } from '../../kit/catalogue/chapter.js';
import { kindMatrix } from './kind-matrix.js';

const KINDS_SUITE = resolve(import.meta.dirname, '../../../specs/kinds');

const CONFIGURATION = resolve(import.meta.dirname, '../../../docs/reference/configuration.md');

// invariant: the matrix is a projection of the declaration and the kinds suite; `TEST_UPDATE=1 npm test` regenerates it.

describe('kindMatrix', () => {
    test('every declared kind has its specimen, and no specimen stands for an undeclared one', () => {
        // Given - the kinds suite of the specs
        const { refused } = kindMatrix(KINDS_SUITE);

        // Then - each kind is proven by a project of its own
        expect(refused).toStrictEqual([]);
    });

    test('a declared kind whose specimen is gone, and a folder for no kind, are both named', () => {
        // Given - the suite without its mobile specimen, and with a folder named for no kind
        const copy = mkdtempSync(join(tmpdir(), 'kinds-'));
        try {
            cpSync(KINDS_SUITE, copy, {
                filter: (source) => !source.includes(join('kinds', 'mobile')),
                recursive: true,
            });
            cpSync(join(KINDS_SUITE, 'cli'), join(copy, 'desktop'), { recursive: true });

            // Then - the matrix refuses both
            expect(kindMatrix(copy).refused).toStrictEqual([
                'mobile: no specimen declaring it',
                'desktop: a specimen of no declared kind',
            ]);
        } finally {
            rmSync(copy, { force: true, recursive: true });
        }
    });

    test('the matrix the manual carries is the one the declaration and the suite render', () => {
        // Given - the generated block of the configuration chapter
        const markers = generatedMarkers('kinds');
        const { table } = kindMatrix(KINDS_SUITE);
        if (process.env.TEST_UPDATE === '1') {
            const page = readFileSync(CONFIGURATION, 'utf8');
            writeFileSync(CONFIGURATION, spliceBetween(page, markers, table, CONFIGURATION));
        }
        const page = readFileSync(CONFIGURATION, 'utf8');
        const carried = page.slice(
            page.indexOf(markers.start) + markers.start.length,
            page.indexOf(markers.end),
        );

        // Then - the page carries exactly what renders today
        expect(carried.trim()).toBe(table);
    });
});
