import { grep } from '@jterrazz/test';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { oxlintSpec } from '../../setup/oxlint.specification.js';

const ROOT_DIR = resolve(import.meta.dirname, '../../..');
const HEXAGONAL_CONFIG = resolve(ROOT_DIR, 'presets/oxlint/architectures/hexagonal.js');
const HEXAGONAL_DIR = resolve(import.meta.dirname, 'hexagonal');

describe('architecture', () => {
    let result: any;

    beforeAll(async () => {
        // Given — run oxlint with hexagonal config on fixture dir (absolute path for plugin resolution)
        result = await oxlintSpec('hexagonal')
            .exec(`-c ${HEXAGONAL_CONFIG} ${HEXAGONAL_DIR}`)
            .run();
    });

    describe('domain layer', () => {
        test('allows pure domain files', () => {
            // Then — arch-hexagonal does NOT trigger on valid domain
            expect(grep(result.stdout, 'domain/user.entity.ts')).not.toContain('arch-hexagonal');
        });

        test('rejects domain importing infrastructure', () => {
            // Then — arch-hexagonal triggers on invalid domain import
            expect(grep(result.stdout, 'domain/invalid-domain.ts')).toContain('arch-hexagonal');
        });
    });

    describe('application layer', () => {
        test('allows use cases importing domain', () => {
            // Then — arch-hexagonal does NOT trigger on valid use case
            expect(grep(result.stdout, 'application/use-cases/get-user.ts')).not.toContain(
                'arch-hexagonal',
            );
        });

        test('rejects use cases importing infrastructure', () => {
            // Then — arch-hexagonal triggers on invalid use case
            expect(grep(result.stdout, 'application/use-cases/invalid-use-case.ts')).toContain(
                'arch-hexagonal',
            );
        });
    });

    describe('presentation layer', () => {
        test('allows pure UI atoms', () => {
            // Then — arch-hexagonal does NOT trigger on valid atom
            expect(grep(result.stdout, 'presentation/ui/atoms/button.tsx')).not.toContain(
                'arch-hexagonal',
            );
        });

        test('rejects atoms importing navigation', () => {
            // Then — arch-hexagonal triggers on invalid atom
            expect(grep(result.stdout, 'presentation/ui/atoms/invalid-atom.tsx')).toContain(
                'arch-hexagonal',
            );
        });
    });
});
