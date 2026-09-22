import { expect, test } from 'vitest';

import { cli as installMatrixCli } from '../install-matrix.specification.js';

/*
 * A chain, not a document: the sandbox runner builds its own install tree.
 *
 * One consumer per profile, and a second `node` one that is a published
 * package, each the smallest honest project — the manifest, the tsconfig
 * extending its preset, the two config files, one source file and one test
 * file. What they prove is the whole
 * consumer contract at once: the profile resolves from a strict install, the
 * preset it names exists, the documented config form type-checks under it, and
 * `typescript check` is green on a project that has done nothing wrong.
 *
 * `specs/cli/preset/fixtures/install-matrix/<profile>[-<shape>]/` is the
 * ground, and the profile it is for IS its directory name up to the first
 * hyphen — the runner reads the roster off the tree, so a new profile earns a
 * consumer by existing. `node-published` is the `node` profile under the
 * `library` tsconfig preset, with a `tsdown.config.ts` importing the bundle
 * preset.
 */

test('every profile installs strict and checks green', async () => {
    // Given - one consumer per profile, each installed the way pnpm installs
    const result = await installMatrixCli.exec();

    // Then - every consumer passed `typescript check`
    expect(result.exitCode).toBe(0);
    for (const consumer of ['astro', 'bun', 'expo', 'next', 'node', 'node-published', 'react']) {
        expect(result.stdout.text).toContain(`checked: ${consumer}`);
    }
    // Seven strict installs, not one: the chain earns four times the e2e budget.
}, 120_000);
