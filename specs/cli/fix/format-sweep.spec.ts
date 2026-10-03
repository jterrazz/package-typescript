import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { FORMATTED, formatter, MISFORMATTED, sweptRepository } from '../_setup/format-sweep.js';

describe('format-sweep', () => {
    test('rewrites the new file without a git add, and leaves the ground and the ignored file as they were', async () => {
        // Given - a repository whose tracked source file and new source file are misformatted, beside a misformatted ground file and a misformatted ignored file
        // When - the fixes run
        const result = await formatter
            .fixture(directory('../_fixtures/format-sweep/misformatted/'))
            .prepare(sweptRepository(MISFORMATTED))
            .exec('fix');

        // Then - both source files are formatted, and neither of the others moved
        expect(
            ['src/index.ts', 'src/added.ts', 'specs/_fixtures/broken.ts', 'local/scratch.ts'].map(
                (path) => result.file(path).content,
            ),
        ).toStrictEqual([FORMATTED, FORMATTED, MISFORMATTED, MISFORMATTED]);
    });
});
