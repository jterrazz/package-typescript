import { describe, expect, test } from 'vitest';

import { manual, messageOf, rulesBrokenBy, violationOf, withDecisions } from './docs.fixtures.js';

describe('docs.decisions', () => {
    test('auditDecisions — passes a well-formed decisions folder', () => {
        // Given - one record on the mold, beside the mold itself
        // Then - nothing to say
        expect(rulesBrokenBy(withDecisions())).toStrictEqual([]);
    });

    test('auditDecisions — names a decision file that is not NNN-kebab.md', () => {
        // Given - a record named without its number
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/v002-the-second-call.md'],
        });

        // Then - the mold of the name is stated, and the file is no record to number
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-named-by-number-and-subject']);
        expect(violationOf(tree, 'docs/decision-named-by-number-and-subject')).toStrictEqual({
            message: 'docs/decisions/v002-the-second-call.md is not NNN-kebab.md',
            path: 'docs/decisions/v002-the-second-call.md',
        });
    });

    test('auditDecisions — names a decision opening on the wrong heading', () => {
        // Given - a record whose title forgets the ADR number
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# The first call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - the line it opens on, and the mold it owes
        expect(violationOf(tree, 'docs/decision-heading-carries-its-number')).toStrictEqual({
            message:
                'docs/decisions/001-the-first-call.md opens on # The first call: the mold is "# ADR-001: Title"',
            path: 'docs/decisions/001-the-first-call.md',
        });
    });

    test('auditDecisions — names a decision that opens on nothing at all', () => {
        // Given - a record whose head was never read, or is empty
        const tree = withDecisions({ heads: {} });

        // Then - the empty line is named as one, and the missing status line too
        expect(messageOf(tree, 'docs/decision-heading-carries-its-number')).toBe(
            'docs/decisions/001-the-first-call.md opens on an empty line: the mold is "# ADR-001: Title"',
        );
        expect(violationOf(tree, 'docs/decision-status-known')).toStrictEqual({
            message:
                'docs/decisions/001-the-first-call.md carries no **Status:** line; the mold is "**Status:** Proposed"',
            path: 'docs/decisions/001-the-first-call.md',
        });
    });

    test('auditDecisions — names a decision whose heading claims another number', () => {
        // Given - a record numbered 001 titled ADR-002
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-002: The first call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - the same rule catches the disagreement
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-heading-carries-its-number']);
    });

    test('auditDecisions — names a decision outside the status vocabulary', () => {
        // Given - a record declaring a status nobody defined
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-001: The first call',
                    '',
                    '**Status:** Draft',
                ],
            },
        });

        // Then - the four the vocabulary holds
        expect(messageOf(tree, 'docs/decision-status-known')).toBe(
            'docs/decisions/001-the-first-call.md: **Status:** is none of Proposed, Accepted, Superseded by [ADR-NNN](file.md), Deprecated',
        );
    });

    test('auditDecisions — accepts a superseded status that links the record replacing it', () => {
        // Given - the one status carrying an argument, written as a citation
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-001: The first call',
                    '',
                    '**Status:** Superseded by [ADR-014](014-the-later-call.md)',
                ],
            },
        });

        // Then - nothing to say
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('auditDecisions — refuses a superseded status with no link naming the successor', () => {
        // Given - the bare form: a successor is named, but not as a place to look
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-001: The first call',
                    '',
                    '**Status:** Superseded by ADR-014',
                ],
            },
        });

        // Then - the missing link is the whole complaint
        expect(messageOf(tree, 'docs/decision-status-known')).toBe(
            'docs/decisions/001-the-first-call.md: **Status:** names a successor but no link; write Superseded by [ADR-NNN](file.md)',
        );
    });

    test('auditDecisions — passes an empty decisions folder', () => {
        // Given - the folder exists but holds no record yet
        const tree = manual({ files: [...manual().files, 'docs/decisions/'] });

        // Then - a folder with nothing to number has no sequence to break
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-template-present']);
    });

    test('auditDecisions — passes a decisions folder holding only the template', () => {
        // Given - the mold, and not a single record beside it
        const tree = manual({
            files: [...manual().files, 'docs/decisions/', 'docs/decisions/_template.md'],
        });

        // Then - nothing to say
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('auditDecisions — refuses a decision sequence that starts above 001', () => {
        // Given - 006 and 008, with nothing numbered before them
        const tree = withDecisions({
            files: [
                ...manual().files,
                'docs/decisions/',
                'docs/decisions/006-the-sixth-call.md',
                'docs/decisions/008-the-eighth-call.md',
                'docs/decisions/_template.md',
            ],
            heads: {
                'docs/decisions/006-the-sixth-call.md': [
                    '# ADR-006: The sixth call',
                    '',
                    '**Status:** Accepted',
                ],
                'docs/decisions/008-the-eighth-call.md': [
                    '# ADR-008: The eighth call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - the same rule, from an offset start
        expect(violationOf(tree, 'docs/decisions-numbered-contiguously')).toStrictEqual({
            message:
                'docs/decisions/ numbers run 006, 008: they run from 001 with no gap, and a decision that moved folders takes the next number where it lands',
            path: 'docs/decisions/',
        });
    });

    test('auditDecisions — refuses a gap after 001', () => {
        // Given - 001 then 003
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/003-the-third-call.md'],
            heads: {
                ...withDecisions().heads,
                'docs/decisions/003-the-third-call.md': [
                    '# ADR-003: The third call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - one record in place does not excuse the gap
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decisions-numbered-contiguously']);
    });

    test('auditDecisions — judges the sequence of records listed out of order', () => {
        // Given - 002 listed before 001
        const tree = withDecisions({
            files: [
                ...manual().files,
                'docs/decisions/',
                'docs/decisions/002-the-second-call.md',
                ...withDecisions().files.filter((path) => path.startsWith('docs/decisions/0')),
                'docs/decisions/_template.md',
            ],
            heads: {
                ...withDecisions().heads,
                'docs/decisions/002-the-second-call.md': [
                    '# ADR-002: The second call',
                    '',
                    '**Status:** Accepted',
                ],
            },
        });

        // Then - the run is read by number, and it has no gap
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('auditDecisions — lets a duplicated number pass the sequence check on its own', () => {
        // Given - two records claiming 001, and none other, so the set is just {001}
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/001-the-same-call.md'],
            heads: {
                ...withDecisions().heads,
                'docs/decisions/001-the-same-call.md': [
                    '# ADR-001: The same call',
                    '',
                    '**Status:** Proposed',
                ],
            },
        });

        // Then - docs/decision-number-unique still refuses it; the sequence itself is not the gap
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-number-unique']);
    });

    test('auditDecisions — names a number two records claim', () => {
        // Given - two records numbered 001
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/001-the-same-call.md'],
            heads: {
                ...withDecisions().heads,
                'docs/decisions/001-the-same-call.md': [
                    '# ADR-001: The same call',
                    '',
                    '**Status:** Proposed',
                ],
            },
        });

        // Then - both claimants are named
        expect(violationOf(tree, 'docs/decision-number-unique')).toStrictEqual({
            message: 'ADR-001 is claimed by 001-the-first-call.md and 001-the-same-call.md',
            path: 'docs/decisions/',
        });
    });

    test('auditDecisions — names a hand-written decisions index', () => {
        // Given - a README.md listing the records
        const tree = withDecisions({
            files: [...withDecisions().files, 'docs/decisions/README.md'],
        });

        // Then - an index is a copy, and the queue is derived; its name is no misnamed record
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/decision-listed-in-the-map']);
        expect(violationOf(tree, 'docs/decision-listed-in-the-map')).toStrictEqual({
            message:
                'docs/decisions/README.md is an index, and an index is a copy; the queue is derived (terra <brand> decisions)',
            path: 'docs/decisions/README.md',
        });
    });

    test('auditDecisions — names a decisions folder with no mold', () => {
        // Given - records with no _template.md beside them
        const tree = withDecisions({
            files: withDecisions().files.filter((path) => path !== 'docs/decisions/_template.md'),
        });

        // Then - the mold sits where the record is written
        expect(violationOf(tree, 'docs/decision-template-present')).toStrictEqual({
            message:
                'docs/decisions/_template.md is missing: the mold sits where the record is written',
            path: 'docs/decisions/_template.md',
        });
    });

    test.each([
        ['Deprecated', []],
        ['Proposed', []],
        ['Superseded by [ADR-014](014-the-later-call.md) in time', ['docs/decision-status-known']],
        ['Not Superseded by [ADR-014](014-the-later-call.md)', ['docs/decision-status-known']],
        ['Superseded by ADR-014 in time', ['docs/decision-status-known']],
        ['Was Superseded by ADR-014', ['docs/decision-status-known']],
    ])('auditDecisions — reads the status %s whole', (status, broken) => {
        // Given - a record declaring the status, alone on its line
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-001: The first call',
                    '',
                    `**Status:** ${status}`,
                ],
            },
        });

        // Then - a status from the vocabulary passes, and one carrying words before or after a successor is none of it
        expect(rulesBrokenBy(tree)).toStrictEqual(broken);
        expect(
            messageOf(tree, 'docs/decision-status-known')?.includes('names a successor'),
        ).not.toBe(true);
    });

    test.each([
        '001-the-first-call.md.bak',
        '001-The-first-call.md',
        '001-the-First-call.md',
        '001-the-first-Call.md',
        '1001-the-first-call.md',
    ])('auditDecisions — refuses the record name %s', (name) => {
        // Given - a file whose name is NNN-kebab.md but for one detail
        const tree = withDecisions({ files: [...withDecisions().files, `docs/decisions/${name}`] });

        // Then - the name is refused as no record of the mold
        expect(violationOf(tree, 'docs/decision-named-by-number-and-subject')?.path).toBe(
            `docs/decisions/${name}`,
        );
    });

    test('auditDecisions — reads a heading and a status line only from the start of their line', () => {
        // Given - a record whose heading and status are quoted after other words
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    'Note # ADR-001: The first call',
                    '',
                    'See **Status:** Accepted',
                ],
            },
        });

        // Then - neither is the line the mold asks for
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/decision-heading-carries-its-number',
            'docs/decision-status-known',
        ]);
    });

    test('auditDecisions — reads a status written against its marker', () => {
        // Given - **Status:** with no space before the word
        const tree = withDecisions({
            heads: {
                'docs/decisions/001-the-first-call.md': [
                    '# ADR-001: The first call',
                    '',
                    '**Status:**Accepted',
                ],
            },
        });

        // Then - the word is the status, and it is known
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });
});
