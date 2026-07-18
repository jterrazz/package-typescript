import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

const HEXAGONAL_CONFIG = resolve(
    import.meta.dirname,
    '../../../presets/oxlint/architectures/hexagonal.js',
);

type LintResult = Awaited<ReturnType<typeof oxlintCli.exec>>;

describe('hexagonal architecture', () => {
    let result: LintResult;

    beforeAll(async () => {
        // Stage the hexagonal case tree in the cwd, then lint it with the hexagonal config.
        // Grep is the scalpel: each layer boundary is a targeted presence/absence probe.
        result = await oxlintCli
            .fixture('architecture')
            .exec(`-c ${HEXAGONAL_CONFIG} architecture`);
    });

    test('allows pure domain files', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal does not trigger on a valid domain file
        expect(result.stdout.grep('domain/user.entity.ts')).not.toContain('arch-hexagonal');
    });

    test('rejects a domain importing infrastructure', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal triggers on the invalid domain import
        expect(result.stdout.grep('domain/invalid-domain.ts')).toContain('arch-hexagonal');
    });

    test('allows use cases importing the domain', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal does not trigger on a valid use case
        expect(result.stdout.grep('application/use-cases/get-user.ts')).not.toContain(
            'arch-hexagonal',
        );
    });

    test('rejects use cases importing infrastructure', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal triggers on the invalid use case
        expect(result.stdout.grep('application/use-cases/invalid-use-case.ts')).toContain(
            'arch-hexagonal',
        );
    });

    test('allows pure UI atoms', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal does not trigger on a valid atom
        expect(result.stdout.grep('presentation/ui/atoms/button.tsx')).not.toContain(
            'arch-hexagonal',
        );
    });

    test('rejects atoms importing navigation', () => {
        // Given - the hexagonal config linting the case tree
        // Then - arch-hexagonal triggers on the invalid atom
        expect(result.stdout.grep('presentation/ui/atoms/invalid-atom.tsx')).toContain(
            'arch-hexagonal',
        );
    });
});
