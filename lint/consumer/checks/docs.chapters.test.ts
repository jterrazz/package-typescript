import { describe, expect, test } from 'vitest';

import { manual, messageOf, rulesBrokenBy } from './docs.fixtures.js';

describe('auditChapters', () => {
    test('names a chapter that is not NN-kebab.md', () => {
        // Given - a fourth chapter with one digit and an upper-case word
        const tree = manual({
            files: [...manual().files, 'docs/4-Lint_presets.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '4-Lint_presets.md',
                ],
            },
        });

        // Then - the mold is named, and the number it took is still judged
        expect(messageOf(tree, 'docs/chapter-named-by-number-and-subject')).toBe(
            'docs/4-Lint_presets.md is not NN-kebab.md — two digits, lowercase words, single hyphens',
        );
    });

    test('names chapter numbers that skip, and numbers claimed twice', () => {
        // Given - two chapters numbered 05 and none numbered 04
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md', 'docs/05-presets.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '05-building.md',
                    '05-presets.md',
                ],
            },
        });

        // Then - one sentence about the whole run
        expect(messageOf(tree, 'docs/chapters-numbered-contiguously')).toBe(
            'chapter numbers run 01, 02, 03, 05, 05: they are contiguous from 01, one file per number, except that 04 may be absent',
        );
    });

    test('names a chapter sitting on a reserved number', () => {
        // Given - a getting-started chapter taking position 01
        const tree = manual({
            files: ['docs/', 'docs/01-getting-started.md', 'docs/README.md'],
            links: { 'docs/README.md': ['01-getting-started.md'] },
        });

        // Then - the position names its owner
        expect(messageOf(tree, 'docs/spine-number-reserved')).toBe(
            'docs/01-getting-started.md takes number 01, which is reserved for 01-architecture.md',
        );
    });

    test('names each missing spine chapter', () => {
        // Given - a manual holding architecture alone
        const tree = manual({
            files: ['docs/', 'docs/01-architecture.md', 'docs/README.md'],
            links: { 'docs/README.md': ['01-architecture.md'] },
        });

        // Then - developing and testing are each asked for
        expect(rulesBrokenBy(tree)).toStrictEqual([
            'docs/spine-chapters-present',
            'docs/spine-chapters-present',
        ]);
        expect(messageOf(tree, 'docs/spine-chapters-present')).toBe(
            '02-developing.md is missing — the spine is architecture, developing, testing',
        );
    });

    test('asks for 04-operating.md from a repository that ships an image', () => {
        // Given - a Dockerfile at the root or at a workspace member's root
        const tree = manual({
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the reason it is asked for is named
        expect(messageOf(tree, 'docs/operating-chapter-present-when-shipping')).toBe(
            '04-operating.md is missing — this repository ships an image (a Dockerfile)',
        );
    });

    test('asks for 04-operating.md from a published package', () => {
        // Given - a root that declares a kind npm publishes
        const tree = manual({
            ships: { dockerfile: false, infrastructure: false, publishable: true },
        });

        // Then - the third clause of the presence test speaks
        expect(messageOf(tree, 'docs/operating-chapter-present-when-shipping')).toBe(
            '04-operating.md is missing — this repository ships a published package (it declares a library or a cli)',
        );
    });

    test('never asks for 04-operating.md from a repository that ships nothing', () => {
        // Given - no image, no infrastructure, no kind npm publishes
        // Then - the lint only ever requires; it never forbids a 04 either
        expect(rulesBrokenBy(manual())).toStrictEqual([]);
    });

    test('lets 05 follow 03 directly when the repository ships nothing', () => {
        // Given - 01-03 then 05, no 04 chapter, nothing that would ask for one
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md'],
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '05-building.md'],
            },
        });

        // Then - 04 is the one gap the numbering excuses
        expect(rulesBrokenBy(tree)).toStrictEqual([]);
    });

    test('still asks for 04-operating.md from that same shape once it ships', () => {
        // Given - the same 01-03 + 05 shape, but an image this time
        const tree = manual({
            files: [...manual().files, 'docs/05-building.md'],
            links: {
                'docs/README.md': [...(manual().links['docs/README.md'] ?? []), '05-building.md'],
            },
            ships: { dockerfile: true, infrastructure: false, publishable: false },
        });

        // Then - the numbering stays clean; only the presence test speaks
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/operating-chapter-present-when-shipping']);
    });

    test('refuses a gap at 05 even though 04 may be absent', () => {
        // Given - 01-03 then 06, skipping past the one number the spine excuses
        const tree = manual({
            files: [...manual().files, 'docs/06-quality-checks.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '06-quality-checks.md',
                ],
            },
        });

        // Then - only 04 is excused; 05 still has to be there
        expect(rulesBrokenBy(tree)).toStrictEqual(['docs/chapters-numbered-contiguously']);
    });

    test('names a chapter that is a journal, not a subject', () => {
        // Given - a fourth chapter recording a design exploration
        const tree = manual({
            files: [...manual().files, 'docs/04-design-exploration.md'],
            links: {
                'docs/README.md': [
                    ...(manual().links['docs/README.md'] ?? []),
                    '04-design-exploration.md',
                ],
            },
        });

        // Then - the word is named, and so is where that content belongs
        expect(messageOf(tree, 'docs/chapter-names-a-subject')).toBe(
            "docs/04-design-exploration.md names a journal, not a subject — exploration; the record is an ADR, the history is git's",
        );
    });
});
