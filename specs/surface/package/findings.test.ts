import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import plugin from '../../../lint/rules/plugin.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const PASS_ID =
    /(?:['"`]|\\n)(?<id>(?:comments|docs|drift|markdown|names|publish|secrets|suppressions)\/[a-z\d]+(?:-[a-z\d]+)*)(?![\w/-])/gu;

const FAMILIES = new Set([
    'comments',
    'docs',
    'drift',
    'markdown',
    'names',
    'publishing',
    'secrets',
    'suppressions',
    'tree',
]);

type Row = { family: string; id: string; sentence: string };

function isRow(value: unknown): value is Row {
    return typeof value === 'object' && value !== null && 'id' in value && 'family' in value;
}

const parsed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'lint/catalogue/findings.json'), 'utf8'),
);
const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => isRow(row));

function printedIds(): string[] {
    const checks = join(ROOT, 'lint/checks');
    const fromPasses = readdirSync(checks)
        .filter((name) => name.endsWith('.js'))
        .flatMap((name) =>
            [...readFileSync(join(checks, name), 'utf8').matchAll(PASS_ID)].map(
                (match) => match.groups?.id ?? '',
            ),
        );
    const fromRules = Object.keys(plugin.rules).map((rule) => `${plugin.meta.name}/${rule}`);

    return [...new Set([...fromPasses, ...fromRules])].toSorted();
}

describe('findings', () => {
    test('the catalogue holds every id a pass or a rule prints, and no other', () => {
        // Given - every finding id written in a pass, and every rule the plugin registers
        const printed = printedIds();
        expect(printed.length).toBeGreaterThan(50);

        // Then - each has its row, and each row is still printed somewhere
        expect(rows.map((row) => row.id).toSorted()).toStrictEqual(printed);
    });

    test('every row states its family and the one sentence it holds a project to', () => {
        // Given - every row of the findings catalogue
        // Then - its family is a word of the closed list, and its sentence is one sentence
        for (const row of rows) {
            expect.soft(FAMILIES, `${row.id} has an unknown family`).toContain(row.family);
            expect.soft(row.sentence, `${row.id} states no sentence`).toMatch(/^[A-Z`].*\.$/u);
        }
    });
});
