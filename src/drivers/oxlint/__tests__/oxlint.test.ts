import { chmodSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../../lint/kit/project/package-root.js';
import { recordingTool } from '../../__tests__/recording-tool.fixtures.js';
import {
    fixedUnder,
    linted,
    pathWithTsgolint,
    suppressionsRecorded,
    withTsgolintOnPath,
} from '../oxlint.js';

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
        // Given - the config's arguments and the targets
        const tool = recordingTool();

        // When - the suppressions are recorded
        await suppressionsRecorded(tool.binary, ['-c', 'oxlint.config.ts'], ['src/a.ts']);

        // Then - two runs, in that order, printing nothing
        expect(tool.calls()).toStrictEqual(
            ['--suppress-all', '--prune-suppressions'].map((recording) => ({
                args: ['-c', 'oxlint.config.ts', '--type-aware', recording, 'src/a.ts'],
                silent: true,
            })),
        );
    });

    test('pathWithTsgolint — puts the folder of an installed tsgolint first, and leaves the path alone for a bare name or a file nobody holds', () => {
        // Given - an installed binary, a bare name, and a path that holds no file
        const tool = recordingTool();
        const installed = join(tool.directory, 'tsgolint');
        writeFileSync(installed, '#!/bin/sh\n');
        chmodSync(installed, 0o755);

        // Then - the folder leads where a file is, and nothing is added otherwise
        expect([
            pathWithTsgolint(installed, '/usr/bin'),
            pathWithTsgolint(installed, undefined),
            pathWithTsgolint('tsgolint', '/usr/bin'),
            pathWithTsgolint(join(tool.directory, 'absent/tsgolint'), '/usr/bin'),
        ]).toStrictEqual([
            `${realpathSync(tool.directory)}${delimiter}/usr/bin`,
            `${realpathSync(tool.directory)}${delimiter}`,
            '/usr/bin',
            '/usr/bin',
        ]);
    });

    test('withTsgolintOnPath — puts the folder of the tsgolint it finds first on the PATH', () => {
        // Given - the PATH, and the folder of the tsgolint beside this package
        const folder = realpathSync(dirname(binaryIn('tsgolint', HOISTED_BESIDE_PACKAGE)));
        vi.stubEnv('PATH', '/usr/bin');

        // When - the tsgolint is put on it
        withTsgolintOnPath();

        // Then - its folder leads
        expect(process.env.PATH).toBe(`${folder}${delimiter}/usr/bin`);
    });
});
