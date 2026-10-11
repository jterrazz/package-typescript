import type { Teaching } from '../../kit/catalogue/lesson.js';
import { defineCheck, rowNamed } from '../../kit/catalogue/rule.js';
import type { Finding } from '../../kit/checker/pass.js';
import FINDINGS from '../catalogue/findings.json' with { type: 'json' };

const READ = 'docs/reference/quality-checks.md#the-config-one-file-pass';

const NAMESPACE = 'config';

const ROWS = FINDINGS.map((row) => ({ name: row.id, sentence: row.sentence }));

/** A finding of the Config (one file) pass, its sentence read from the catalogue. */
export function configFinding(
    id: `config/${string}`,
    path: string,
    teaching: Teaching,
    fixed = false,
): Finding {
    const { sentence } = rowNamed(ROWS, id);
    const name = id.slice(NAMESPACE.length + 1);
    const check = defineCheck({ docs: { name, sentence }, namespace: NAMESPACE, read: READ });

    return {
        ...check.finding({ column: 1, line: 1, path }, teaching),
        ...(fixed ? { fixed } : {}),
    };
}

/** A file of a unit, named from the repository's root. */
export const prefixed = (unit: string, file: string): string =>
    unit === '.' ? file : `${unit}/${file}`;
