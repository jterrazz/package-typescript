import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { isBrowserSide, unmeasuredBrowserMutants } from '../browser-side.js';

const units: string[] = [];

function unitWith(report: string | undefined): string {
    const unit = mkdtempSync(join(tmpdir(), 'browser-side-'));
    units.push(unit);
    if (report !== undefined) {
        mkdirSync(join(unit, '.artifacts/stryker'), { recursive: true });
        writeFileSync(join(unit, '.artifacts/stryker/report.json'), report);
    }

    return unit;
}

afterEach(() => {
    for (const unit of units.splice(0)) {
        rmSync(unit, { force: true, recursive: true });
    }
});

describe('browser-side', () => {
    test('isBrowserSide — a component, an island and a template run in the browser, a module does not', () => {
        // Given - the five browser-side extensions, and the files a server reads
        const browser = ['a.astro', 'a.jsx', 'a.svelte', 'a.tsx', 'a.vue'];
        const server = ['a.ts', 'a.js', 'a.tsx.snap', 'tsx', 'atsx'];

        // Then - the first are browser-side, the others not
        expect([browser.map(isBrowserSide), server.map(isBrowserSide)]).toStrictEqual([
            browser.map(() => true),
            server.map(() => false),
        ]);
    });

    test('unmeasuredBrowserMutants — counts the mutants of browser-side files no test ran, and none of a detected one or a server file', () => {
        // Given - a report with two unclaimed mutants of an island, a killed one, an unclaimed one of a module, and a file with no mutants listed
        const mutant = (status: string): object => ({ status });
        const unit = unitWith(
            JSON.stringify({
                files: {
                    'src/island.tsx': {
                        mutants: [mutant('NoCoverage'), mutant('NoCoverage'), mutant('Killed')],
                    },
                    'src/page.astro': { mutants: 'none' },
                    'src/server.ts': { mutants: [mutant('NoCoverage')] },
                },
            }),
        );

        // Then - the two of the island
        expect(unmeasuredBrowserMutants(unit)).toBe(2);
    });

    test('unmeasuredBrowserMutants — a unit with no report, or one that is no JSON, holds no count', () => {
        // Given - a unit that ran no mutation, and one whose report is cut short
        // Then - neither holds a count
        expect([
            unmeasuredBrowserMutants(unitWith(undefined)),
            unmeasuredBrowserMutants(unitWith('{"files":')),
        ]).toStrictEqual([null, null]);
    });
});
