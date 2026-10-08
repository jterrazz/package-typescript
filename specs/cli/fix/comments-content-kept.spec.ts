import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('comments-content-kept', () => {
    test('neither judges nor rewrites a comment of a content tree or of a root a script writes', async () => {
        // Given - a repository whose assets/, public/ and declared generated root each hold a file with a kindless comment
        const result = await cli
            .with({ env: onlyPasses('comments') })
            .fixture(directory('./__fixtures__/comments/content-kept/'))
            .prepare(repository)
            .exec(['fix', 'check']);

        // Then - both commands pass, and every file keeps every byte the fix found
        expect(result.exitCode).toBe(0);
        expect([
            result.file('assets/meta.yaml').content,
            result.file('public/site.css').content,
            result.file('reports/notes.sh').content,
        ]).toStrictEqual([
            '# signed header\ntitle: An article\n',
            '/* signed design note */\nbody {\n    margin: 0;\n}\n',
            '#!/bin/sh\n# written by the release script\necho done\n',
        ]);
    });
});
