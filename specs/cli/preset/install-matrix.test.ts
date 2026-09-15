import { expect, test } from 'vitest';

import { cli as installMatrixCli } from '../install-matrix.specification.js';

/*
 * A chain, not a document: the sandbox runner builds its own install tree.
 *
 * Six consumers, one per profile, each the smallest honest project — the
 * manifest, the tsconfig extending that profile's preset, the two config
 * files, one source file and one test file. What they prove is the whole
 * consumer contract at once: the profile resolves from a strict install, the
 * preset it names exists, the documented config form type-checks under it, and
 * `typescript check` is green on a project that has done nothing wrong.
 *
 * `specs/cli/preset/_fixtures/install-matrix/<profile>/` is the ground, and the
 * profile it is for IS its directory name — the runner reads the roster off the
 * tree, so a seventh profile earns a consumer by existing.
 */

test('every profile installs strict and checks green', async () => {
    // Given - one consumer per profile, each installed the way pnpm installs
    const result = await installMatrixCli.exec();

    // Then - every one of the six passed `typescript check`
    expect(result.exitCode).toBe(0);
    for (const profile of ['astro', 'bun', 'expo', 'library', 'next', 'node']) {
        expect(result.stdout.toString()).toContain(`checked: ${profile}`);
    }
});
