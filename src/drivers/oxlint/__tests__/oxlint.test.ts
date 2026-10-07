import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { recordingTool } from '../../__tests__/recording-tool.fixtures.js';
import { fixedUnder, linted, suppressionsRecorded } from '../oxlint.js';

describe('oxlint', () => {
    test('a lint appends both streams of oxlint to the log another run already wrote', async () => {
        // Given - a log a run before this one wrote
        const tool = recordingTool();
        const log = join(tool.directory, 'lint.log');
        writeFileSync(log, 'before\n');

        // When - oxlint lints
        await linted(tool.binary, ['--deny-warnings', 'src/a.ts'], log);

        // Then - its report follows what was there
        expect(readFileSync(log, 'utf8')).toBe('before\nprinted\nwarned\n');
        expect(tool.calls()).toStrictEqual([
            { args: ['--deny-warnings', 'src/a.ts'], silent: false },
        ]);
    });

    test('a fix runs under the wrapper config, which oxlint is told not to lint', async () => {
        // Given - a wrapper config written beside the project
        const tool = recordingTool();

        // When - the fixes are applied under it
        await fixedUnder(
            tool.binary,
            '/project/.fix-wrapper.json',
            ['src/a.ts'],
            join(tool.directory, 'fix.log'),
        );

        // Then - type-aware, fixing, configured by the wrapper and ignoring it
        expect(tool.calls()).toStrictEqual([
            {
                args: [
                    '--type-aware',
                    '--fix',
                    '-c',
                    '/project/.fix-wrapper.json',
                    '--ignore-pattern',
                    '.fix-wrapper.json',
                    'src/a.ts',
                ],
                silent: false,
            },
        ]);
    });

    test('recording the suppressions suppresses every report, then prunes the ones no report needs, silently', async () => {
        // Given - the config's arguments, the caller's and the targets
        const tool = recordingTool();

        // When - the suppressions are recorded
        await suppressionsRecorded(
            tool.binary,
            ['-c', 'oxlint.config.ts'],
            ['--quiet'],
            ['src/a.ts'],
        );

        // Then - two runs, in that order, printing nothing
        expect(tool.calls()).toStrictEqual(
            ['--suppress-all', '--prune-suppressions'].map((recording) => ({
                args: ['-c', 'oxlint.config.ts', '--type-aware', recording, '--quiet', 'src/a.ts'],
                silent: true,
            })),
        );
    });
});
