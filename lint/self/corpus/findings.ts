import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import plugin from '../../consumer/rules/plugin.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const PASS_ID =
    /(?:['"`]|\\n)(?<id>(?:comments|docs|drift|markdown|names|publish|secrets|suppressions)\/[a-z\d]+(?:-[a-z\d]+)*)(?![\w/-])/gu;

const listed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'lint/consumer/catalogue/families.json'), 'utf8'),
);
export const FAMILIES = new Set(Array.isArray(listed) ? listed : []);

type Row = { family: string; id: string; sentence: string };

function isRow(value: unknown): value is Row {
    return typeof value === 'object' && value !== null && 'id' in value && 'family' in value;
}

const parsed: unknown = JSON.parse(
    readFileSync(join(ROOT, 'lint/consumer/catalogue/findings.json'), 'utf8'),
);
export const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => isRow(row));

const checks = join(ROOT, 'lint/consumer/checks');

const fromPasses = readdirSync(checks)
    .filter((name) => name.endsWith('.js'))
    .flatMap((name) =>
        [...readFileSync(join(checks, name), 'utf8').matchAll(PASS_ID)].map(
            (match) => match.groups?.id ?? '',
        ),
    );

const fromRules = Object.keys(plugin.rules).map((rule) => `${plugin.meta.name}/${rule}`);

export const PRINTED_IDS = [...new Set([...fromPasses, ...fromRules])].toSorted();
