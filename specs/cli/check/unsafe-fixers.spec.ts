import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * A chain, not a document: each claim is about the file `fix` leaves, read
 * by content rather than stated whole, beside the verdict. Every case is the
 * same small project, `fixtures/unsafe-fixers/project/`, with the one source
 * file of the case laid over it, and the config where the case needs its own.
 * A case that needs a root-only option — unused directives reported, type
 * information — runs the default profile, which ships both: a nested config
 * naming `options` is refused wherever oxlint walks this repository, and
 * `@jterrazz/test`'s checker, run alone, walks it whole.
 *
 * `unicorn/no-useless-undefined` stands for the eight: its fixer strips an
 * argument the callee requires, so `fix` must leave the line alone and
 * report it exactly as `check` does — the answer is a human's, and the two
 * commands read one verdict on one tree.
 */

/** The runner on the project, with one case's config and source laid over it. */
const caseOf = (name: string) =>
    cli
        .fixture(directory('./fixtures/unsafe-fixers/project/'))
        .fixture(directory(`./fixtures/unsafe-fixers/${name}/`));

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

    /*
     * The wrapper turns twelve rules off for its own run, and a run that has just
     * disarmed a rule cannot judge a directive naming it: the evidence is the
     * wrapper's, not the project's. Only reachable in a log the pass PRINTS, which
     * is a failing one — hence the second, unsuppressed call in the case.
     */
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

    /*
     * The wrapper is the pass's own file: it is written at the project root, read
     * by the run it configures and deleted after it. A diagnostic against it names
     * a path the operator cannot open and no tree can ever clear, so the run that
     * writes it ignores it — including one an EARLIER run left behind, when it
     * crashed before its own `rm -f` ran, and this one's sweep would otherwise
     * pick up as an ordinary untracked file.
     */
    test('never reports the wrapper config, including one a crashed run left behind', async () => {
        // Given - a project whose oxlint.fix.config.mjs, an absolute import, already sits at its root — the shape a crashed prior run's own wrapper would leave, and a rule armed that names exactly that
        // When - the fix runs, with a diagnostic of the tree's own to keep the log on the stream
        const fixed = await caseOf('wrapper-rules').exec('fix');

        // Then - it names the tree's diagnostic, and never the leftover wrapper
        expect(fixed.stdout.text).toContain('no-useless-undefined');
        expect(fixed.stdout.text).not.toContain('oxlint.fix.config');
    });

    /*
     * The same claim, one layer down. Every case above arms a rule oxlint itself
     * decides; the wrapper's `overrides` block is oxlint's own vocabulary and
     * reaching it is oxlint's job. A TYPE-AWARE rule is not oxlint's: it runs in
     * `tsgolint`, a separate binary oxlint hands the file to, and nothing here
     * held that half — the rewrite in the case is the one a spike measured in
     * @jterrazz/test, where a broken module augmentation widened a parameter to
     * `any` and the fixer then read the cast that reached it as unnecessary.
     */
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
