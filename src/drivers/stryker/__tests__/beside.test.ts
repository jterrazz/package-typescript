import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { besideLinksDropped, besideOf, withoutBesideLinks } from '../beside.js';

describe('beside', () => {
    test('besideOf — a member of a repository is placed by its depth, with the visible entries of the repository to lay beside its copy, and a repository itself or a folder outside any is not', () => {
        // Given - a repository holding a member two folders down, a hidden folder, node_modules and visible entries; and a folder in no repository
        const root = mkdtempSync(join(tmpdir(), 'beside-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        mkdirSync(join(root, '.git'));
        mkdirSync(join(root, 'node_modules'));
        mkdirSync(join(root, 'testdata'));
        mkdirSync(join(root, 'docs'));
        mkdirSync(join(root, 'packages/server'), { recursive: true });
        const outside = mkdtempSync(join(tmpdir(), 'beside-none-'));
        onTestFinished(() => {
            rmSync(outside, { force: true, recursive: true });
        });

        // Then - the member is two levels down with docs, packages and testdata beside it; the repository root and the loose folder place nothing
        expect([
            besideOf(join(root, 'packages/server')),
            besideOf(root),
            besideOf(outside),
        ]).toStrictEqual([
            { levels: 2, names: ['docs', 'packages', 'testdata'], root },
            undefined,
            undefined,
        ]);
    });

    test("besideLinksDropped — the links laid in the member's artifacts folder go, a real entry of the same name and a depth that lands elsewhere stay", () => {
        // Given - a member whose artifacts folder holds a link to a repository folder and a real folder of a name also asked for
        const project = mkdtempSync(join(tmpdir(), 'beside-links-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        mkdirSync(join(project, '.artifacts/real'), { recursive: true });
        mkdirSync(join(project, '.artifacts/stryker/tmp/sandbox'), { recursive: true });
        mkdirSync(join(project, 'target'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/apps'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/stray'));
        symlinkSync(join(project, 'target'), join(project, 'apps'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/stryker/tmp/apps'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/stryker/tmp/sandbox/apps'));
        const root = join(project, 'target');
        const links = (): boolean[] =>
            ['apps', '.artifacts/stryker/tmp/apps', '.artifacts/stryker/tmp/sandbox/apps'].map(
                (path) => existsSync(join(project, path)),
            );

        // When - a depth of four, of none and of one are dropped, then three folders out of the copy, naming an entry that does not exist
        besideLinksDropped(project, { levels: 4, names: ['apps'], root });
        besideLinksDropped(project, { levels: 0, names: ['apps'], root });
        const beforeOne = links();
        besideLinksDropped(project, { levels: 1, names: ['apps'], root });
        const afterOne = links();
        const kept = existsSync(join(project, '.artifacts/apps'));
        besideLinksDropped(project, { levels: 3, names: ['apps', 'real', 'missing'], root });

        // Then - the links of depth four and none stay, the one-deep call takes the link a folder above the copy's folder, the three-deep one the link in the artifacts folder, and none touched the real folder or the name not asked for
        expect([
            beforeOne,
            afterOne,
            kept,
            existsSync(join(project, '.artifacts/apps')),
            existsSync(join(project, '.artifacts/real')),
            existsSync(join(project, '.artifacts/stray')),
        ]).toStrictEqual([[true, true, true], [true, false, true], true, false, true, true]);
    });

    test('withoutBesideLinks — takes the links a killed run left before the run starts, and those the run laid when it ends', async () => {
        // Given - a member whose artifacts folder holds a link a killed run left, and a run that lays another
        const project = mkdtempSync(join(tmpdir(), 'beside-run-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        mkdirSync(join(project, '.artifacts'));
        mkdirSync(join(project, 'target'));
        const root = join(project, 'target');
        symlinkSync(root, join(project, '.artifacts/apps'));
        const seen: boolean[] = [];

        // When - the run goes between the two drops
        const result = await withoutBesideLinks(
            project,
            { levels: 3, names: ['apps', 'docs'], root },
            async () => {
                seen.push(existsSync(join(project, '.artifacts/apps')));
                symlinkSync(root, join(project, '.artifacts/docs'));
                seen.push(existsSync(join(project, '.artifacts/docs')));

                return 'ran';
            },
        );

        // Then - the run met no left link and laid its own, which went, and its answer comes back
        expect([seen, existsSync(join(project, '.artifacts/docs')), result]).toStrictEqual([
            [false, true],
            false,
            'ran',
        ]);
    });
});
