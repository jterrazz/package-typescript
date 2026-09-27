import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../_setup/check-passes.js';
import { cli } from '../cli.specification.js';

// A nested config naming `options` is refused wherever oxlint walks this repository, so a case needing a
// root-only option runs the default profile.

const caseOf = (name: string) =>
    cli
        .env(onlyPasses('oxlint'))
        .fixture(directory('./_fixtures/unsafe-fixers/project/'))
        .fixture(directory(`./_fixtures/unsafe-fixers/${name}/`));

describe('unsafe-fixers', () => {
    test('leaves a meaning-changing fixer alone and still reports it', async () => {
        // Given - a project on the default profile, whose only diagnostic is one of the unsafe fixers
        // When - the fix runs
        const fixed = await caseOf('armed').exec('fix');

        // Then - the argument is still there, and fix reports what it left
        expect(fixed.exitCode).toBe(1);
        expect(fixed.stdout.text).toContain('no-useless-undefined');
        expect(fixed.file('index.ts').content).toContain('take(undefined)');
    });

    test('keeps a recorded diagnostic of an unsafe fixer held across fix, though the wrapper disarms its rule', async () => {
        // Given - the same project, its one diagnostic recorded in oxlint-suppressions.json
        // When - the fix runs
        const fixed = await caseOf('armed-held').exec('fix');

        // Then - oxlint's rewrite of the file under the wrapper is undone, so the debt stays held and fix is green
        expect(fixed.exitCode).toBe(0);
        const held: unknown = JSON.parse(fixed.file('oxlint-suppressions.json').content);
        expect(held).toStrictEqual({
            'index.ts': { 'unicorn/no-useless-undefined': { count: 1 } },
        });
    });

    test('still names the rule the fix left, in check, because the answer is a human', async () => {
        // Given - the same project
        // When - the checks run
        const checked = await caseOf('armed').exec('check');

        // Then - the check names the rule the fixer was not allowed to settle
        expect(checked.exitCode).toBe(1);
        expect(checked.stdout.text).toContain('no-useless-undefined');
    });

    test('keeps a directive that names an unsafe fixer used, so fix stays green', async () => {
        // Given - the same project, reporting unused directives as every profile does, one diagnostic suppressed with its reason
        // When - the fix runs with that rule allowed for the rewrite
        const fixed = await caseOf('directive-used').exec('fix');

        // Then - the verdict is the check's, where the rule is armed and the directive used
        expect(fixed.exitCode).toBe(0);
        expect(fixed.stdout.text).not.toContain('Unused oxlint-disable directive');
    });

    // Only reachable in a log the pass prints, which is a failing one: hence the second, unsuppressed call.
    test('never calls a directive dead because the wrapper disarmed its rule', async () => {
        // Given - the same project, one call suppressed with its reason and one left to report
        // When - the fix runs, and fails on the call nothing suppresses
        const fixed = await caseOf('directive-beside-a-diagnostic').exec('fix');

        // Then - the log names that call, and never the live directive above it
        expect(fixed.stdout.text).toContain('no-useless-undefined');
        expect(fixed.stdout.text).not.toContain('Unused oxlint-disable directive');
    });

    test('leaves the fixer alone where an override of the consumer arms the rule again', async () => {
        // Given - the rule off in the base config and armed by an override, the vitest block's shape
        // When - the fix runs
        const fixed = await caseOf('override-armed').exec('fix');

        // Then - the argument survives the rewrite, and the wrapper left no trace
        expect(fixed.exitCode).toBe(1);
        expect(fixed.file('index.ts').content).toContain('take(undefined)');
        expect(fixed.file('oxlint.fix.config.mjs').exists).toBe(false);
    });

    // A crashed run can leave its wrapper behind, where this run's sweep would read it as an untracked file.
    test('never reports the wrapper config, including one a crashed run left behind', async () => {
        // Given - a project whose oxlint.fix.config.mjs, an absolute import, already sits at its root — the shape a crashed prior run's own wrapper would leave, and a rule armed that names exactly that
        // When - the fix runs, with a diagnostic of the tree's own to keep the log on the stream
        const fixed = await caseOf('wrapper-rules').exec('fix');

        // Then - it names the tree's diagnostic, and never the leftover wrapper
        expect(fixed.stdout.text).toContain('no-useless-undefined');
        expect(fixed.stdout.text).not.toContain('oxlint.fix.config');
    });

    // A type-aware rule runs in `tsgolint`, not oxlint, so the wrapper's override must reach it too.
    test('leaves a type-aware fixer alone — the double cast the call still needs', async () => {
        // Given - a project on the default profile, one of whose diagnostics is a type-aware unsafe fixer
        // When - the fix runs
        const fixed = await caseOf('type-aware').exec('fix');

        // Then - the cast survives, so the file still says which type the call receives
        expect(fixed.file('index.ts').content).toContain('widened as unknown as string');

        // Then - and the rule is still reported, because the answer is a human's
        expect(fixed.exitCode).toBe(1);
        expect(fixed.stdout.text).toContain('no-unnecessary-type-assertion');
    });

    // oxlint reads a nested config as the whole config of its subtree, replacing the root's rules.
    test("applies a nested config's profile in fix, as check reads it", async () => {
        // Given - a root arming prefer-const, and a subtree whose own config turns it off and arms prefer-node-protocol
        // When - the fix runs
        const fixed = await caseOf('nested').exec('fix');

        // Then - the root's fixer rewrote the root file, and the subtree's the subtree's
        expect(fixed.file('index.ts').content).toContain('const root');
        expect(fixed.file('sub/index.ts').content).toContain("from 'node:path'");

        // Then - and the rule the subtree turned off did not reach it
        expect(fixed.file('sub/index.ts').content).toContain('let nested');
    });

    test('leaves an unsafe fixer alone under a nested config too, and leaves no wrapper there', async () => {
        // Given - the same subtree, arming one of the unsafe fixers in its own config
        // When - the fix runs
        const fixed = await caseOf('nested').exec('fix');

        // Then - the argument survives, the rule is still reported, and the subtree's wrapper is gone
        expect(fixed.file('sub/index.ts').content).toContain('take(undefined)');
        expect(fixed.exitCode).toBe(1);
        expect(fixed.stdout.text).toContain('no-useless-undefined');
        expect(fixed.file('sub/oxlint.fix.config.mjs').exists).toBe(false);
    });

    test('leaves a mock factory keyed by its module name, which owes no module type', async () => {
        // Given - a project on the default profile, whose one test mocks a module by name with a partial factory
        // When - the fix runs
        const fixed = await caseOf('mock-factory').exec('fix');

        // Then - the name survives, so the factory still owes only what it returns
        expect(fixed.file('index.test.ts').content).toContain("vi.mock('node:fs'");

        // Then - and the rule is still reported, because the answer is a human's
        expect(fixed.exitCode).toBe(1);
        expect(fixed.stdout.text).toContain('prefer-import-in-mock');
    });

    test('leaves a declare module augmentation an interface, and keeps its export {}', async () => {
        // Given - a project whose one file augments a library, with both rewriters armed
        // When - the fix runs
        const fixed = await caseOf('augmentation').exec('fix');

        // Then - the block still merges: an interface, and the export that makes it an augmentation
        const source = fixed.file('index.ts').content;
        expect(source).toContain('interface Options');
        expect(source).toContain('export {};');
    });
});
