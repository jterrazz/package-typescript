import { describe, test } from 'vitest';

import { checkSpec } from '../../setup/check.specification.js';

const IGNORE_ARGS =
    "--ignore-pattern '**/fixtures/**' --ignore-pattern '**/invalid/**' --ignore-pattern '**/hexagonal/**'";

describe('check', () => {
    test('check runs all four tools', async () => {
        // Given — run typescript check from the project root, ignoring fixture directories
        const result = await checkSpec('check all tools').exec(`check ${IGNORE_ARGS}`).run();

        // Then — output contains sections for each tool
        result.stdout.toContain('TypeScript Check');
        result.stdout.toContain('Oxlint');
        result.stdout.toContain('Oxfmt');
        result.stdout.toContain('Knip');
    });

    test('check reports quality checks label', async () => {
        // Given — run typescript check
        const result = await checkSpec('check label').exec(`check ${IGNORE_ARGS}`).run();

        // Then — output contains the quality checks banner
        result.stdout.toContain('Running quality checks');
    });

    test('fix reports quality fixes label', async () => {
        // Given — run typescript fix
        const result = await checkSpec('fix label').exec(`fix ${IGNORE_ARGS}`).run();

        // Then — output contains the quality fixes banner
        result.stdout.toContain('Running quality fixes');
    });
});
