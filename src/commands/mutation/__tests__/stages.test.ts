import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import type { Measured } from '../../../drivers/stryker/stryker.js';
import { afterStage, buildsOf, NOTHING_MEASURED } from '../stages.js';

function projectWith(manifest: string | undefined): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-stages-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    if (manifest !== undefined) {
        writeFileSync(join(root, 'package.json'), manifest);
    }

    return root;
}

describe('stages', () => {
    test('buildsOf — a project builds when its manifest has a build script, and not with another script, none, a broken manifest or no manifest', () => {
        // Given - the five manifests
        const builds = projectWith('{"scripts":{"build":"tsdown"}}');
        const tests = projectWith('{"scripts":{"test":"vitest"}}');
        const bare = projectWith('{}');
        const broken = projectWith('{"scripts":');
        const absent = projectWith(undefined);

        // Then - only the first builds
        expect([builds, tests, bare, broken, absent].map((root) => buildsOf(root))).toStrictEqual([
            true,
            false,
            false,
            false,
            false,
        ]);
    });

    test('afterStage — a stage that failed says its status and runs nothing next; one that measured is handed on whole; one that did not run hands on an empty measure', async () => {
        // Given - a next step recording what it is handed
        const handed: Measured[] = [];
        const next = (measured: Measured): number => {
            handed.push(measured);
            return 7;
        };
        const ran: Measured = { ranByTests: new Set(['a']), report: { files: {} } };

        // When - after a failed stage, a measured one, and none
        const failed = await afterStage({ status: 3 }, next);
        const measured = await afterStage(ran, next);
        const absent = await afterStage(undefined, next);

        // Then - the failure ends it, the others reach next, the last with the empty measure
        expect([failed, measured, absent, handed]).toStrictEqual([
            3,
            7,
            7,
            [ran, { ranByTests: new Set(), report: undefined }],
        ]);
        expect(NOTHING_MEASURED).toStrictEqual({ ranByTests: new Set(), report: undefined });
    });
});
