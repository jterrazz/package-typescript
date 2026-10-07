import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { recordingTool } from '../../__tests__/recording-tool.fixtures.js';
import { filesFormatted, formatted } from '../oxfmt.js';

describe('oxfmt', () => {
    test('a format with no paths formats the project, one with paths tolerates a path that matches nothing, each report replacing the log', async () => {
        // Given - a log an earlier run left
        const tool = recordingTool();
        const log = join(tool.directory, 'format.log');
        writeFileSync(log, 'stale\n');

        // When - the whole project is formatted, then a subset of it
        await formatted(tool.binary, ['--check'], [], log);
        await formatted(tool.binary, ['--check'], ['src/a.ts'], log);

        // Then - the flag only beside paths, and the log holds the last report alone
        expect(tool.calls()).toStrictEqual([
            { args: ['--check'], silent: false },
            { args: ['--check', '--no-error-on-unmatched-pattern', 'src/a.ts'], silent: false },
        ]);
        expect(readFileSync(log, 'utf8')).toBe('printed\nwarned\n');
    });

    test('formatting named files formats them alone, printing nothing', async () => {
        // Given - two files a command wrote
        const tool = recordingTool();

        // When - they are formatted
        await filesFormatted(tool.binary, ['-c', 'oxfmt.config.ts'], 'a.json', 'b.json');

        // Then - those files, silently
        expect(tool.calls()).toStrictEqual([
            {
                args: [
                    '-c',
                    'oxfmt.config.ts',
                    '--no-error-on-unmatched-pattern',
                    'a.json',
                    'b.json',
                ],
                silent: true,
            },
        ]);
    });
});
