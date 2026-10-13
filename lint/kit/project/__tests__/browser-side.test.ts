import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
    clientOnlySources,
    isBrowserSide,
    reportWithUnmeasured,
    unmeasuredBrowserMutants,
} from '../browser-side.js';

const units: string[] = [];

const mutant = (status: string): object => ({ status });

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

    test('clientOnlySources — names the component an Astro page loads with client:only, by a relative import with or without its extension, and no other', () => {
        // Given - a page loading three components, one with client:only over several lines, one hydrated by client:load, one by client:only but imported by a package, and a page naming a component it never imports
        const unit = mkdtempSync(join(tmpdir(), 'client-only-'));
        units.push(unit);
        mkdirSync(join(unit, 'src/components'), { recursive: true });
        for (const name of ['Particles.tsx', 'Menu.tsx', 'Chart.tsx']) {
            writeFileSync(join(unit, 'src/components', name), 'export default null;\n');
        }
        writeFileSync(
            join(unit, 'src/page.astro'),
            [
                '---',
                "import Particles from './components/Particles';",
                "import Menu from './components/Menu.tsx';",
                "import Chart from 'chart-package';",
                "import Missing from './components/Missing';",
                '---',
                '<Particles',
                '    client:only="react"',
                '/>',
                '<Menu client:load />',
                '<Chart client:only="react" />',
                '<Ghost client:only="react" />',
                '<Missing client:only="react" />',
            ].join('\n'),
        );

        // Then - only Particles
        expect([...clientOnlySources(unit)]).toStrictEqual(['src/components/Particles.tsx']);
    });

    test('clientOnlySources — reads nothing of a page it cannot read as text', () => {
        // Given - a page holding NUL, which names a client-only component
        const unit = mkdtempSync(join(tmpdir(), 'client-only-'));
        units.push(unit);
        mkdirSync(join(unit, 'src'), { recursive: true });
        writeFileSync(join(unit, 'src/Orb.tsx'), 'export default null;\n');
        writeFileSync(
            join(unit, 'src/page.astro'),
            "import Orb from './Orb';\n<Orb client:only />\0",
        );

        // Then - the page names no source
        expect([...clientOnlySources(unit)]).toStrictEqual([]);
    });

    test('clientOnlySources — reads an import spread over spaces and lines, and only in an Astro page', () => {
        // Given - a page importing with runs of whitespace between the words, and a markdown file and a component quoting the same lines
        const unit = mkdtempSync(join(tmpdir(), 'client-only-'));
        units.push(unit);
        mkdirSync(join(unit, 'src'), { recursive: true });
        writeFileSync(join(unit, 'src/Spread.tsx'), 'export default null;\n');
        writeFileSync(join(unit, 'src/Quoted.tsx'), 'export default null;\n');
        const lines = ['<Quoted client:only="react" />'];
        writeFileSync(
            join(unit, 'src/page.astro'),
            ["import   Spread   from   './Spread';", '<Spread client:only="react" />'].join('\n'),
        );
        writeFileSync(
            join(unit, 'src/notes.md'),
            ["import Quoted from './Quoted';", ...lines].join('\n'),
        );
        writeFileSync(
            join(unit, 'src/quoting.tsx'),
            ["import Quoted from './Quoted';", ...lines].join('\n'),
        );

        // Then - the spread import resolves, and the quoting files name nothing
        expect([...clientOnlySources(unit)]).toStrictEqual(['src/Spread.tsx']);
    });

    test('clientOnlySources — resolves a component of any framework by its extension, from the page’s folder, however its attributes are ordered, and reads no tag that only starts like client:only', () => {
        // Given - pages in two folders loading a jsx, a vue, a svelte and a shared component, one of them with attributes before client:only, and a tag whose directive only starts like it
        const unit = mkdtempSync(join(tmpdir(), 'client-only-'));
        units.push(unit);
        mkdirSync(join(unit, 'src/pages'), { recursive: true });
        mkdirSync(join(unit, 'src/shared'), { recursive: true });
        for (const path of [
            'src/pages/Wave.jsx',
            'src/pages/Card.vue',
            'src/pages/Orb.svelte',
            'src/shared/Deep.tsx',
            'src/pages/Later.tsx',
        ]) {
            writeFileSync(join(unit, path), 'export default null;\n');
        }
        writeFileSync(
            join(unit, 'src/pages/index.astro'),
            [
                '---',
                "import Wave from './Wave';",
                "import Card from './Card';",
                "import Orb from './Orb';",
                "import Deep from '../shared/Deep';",
                "import Later from './Later';",
                '---',
                '<Wave client:only="react" />',
                '<Card id="a" class="b" client:only="vue" />',
                '<Orb client:only />',
                '<Deep client:only="react" />',
                '<Later client:onlyish />',
            ].join('\n'),
        );

        // Then - the four that load client-only, in the order the page names them, and not the fifth
        expect([...clientOnlySources(unit)]).toStrictEqual([
            'src/pages/Wave.jsx',
            'src/pages/Card.vue',
            'src/pages/Orb.svelte',
            'src/shared/Deep.tsx',
        ]);
    });

    test('reportWithUnmeasured — reads a survivor of a named source as a mutant no test ran, and leaves every other mutant and file as they are', () => {
        // Given - a report with a survivor and a killed mutant in the named source, a survivor in another, and a file with no mutant list
        const report = {
            files: {
                'src/a.tsx': {
                    language: 'typescript',
                    mutants: [mutant('Survived'), mutant('Killed')],
                },
                'src/b.tsx': { mutants: [mutant('Survived')] },
                'src/c.tsx': { mutants: 'none' },
            },
            schemaVersion: '2',
        };

        // Then - only the named source's survivor changes status, a named source set empty changes nothing
        expect(reportWithUnmeasured(report, new Set(['src/a.tsx', 'src/c.tsx']))).toStrictEqual({
            files: {
                'src/a.tsx': {
                    language: 'typescript',
                    mutants: [mutant('NoCoverage'), mutant('Killed')],
                },
                'src/b.tsx': { mutants: [mutant('Survived')] },
                'src/c.tsx': { mutants: 'none' },
            },
            schemaVersion: '2',
        });
        expect(reportWithUnmeasured(report, new Set())).toBe(report);
    });
});
