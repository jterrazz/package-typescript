import { describe, expect, test } from 'vitest';

import { cli as freshCloneCli } from '../fresh-clone.specification.js';

describe('fresh-clone', () => {
    test('builds this package from a clone that holds no build of it', async () => {
        // Given - the files git tracks, installed as `npm ci` installs them: no dist/, and a self-install without one, though studio.config.ts and its presets import the package's own entries
        const result = await freshCloneCli.exec();

        // Then - the clone held no build, and `npm run build` writes the entries that settings file imports, and the command
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('absent before the build: dist');
        expect(result.stdout.text).toContain(
            'absent before the build: node_modules/@jterrazz/typescript/dist',
        );
        expect(result.stdout.text).toContain(
            ['built: dist/config.js', 'built: dist/rules.js', 'built: dist/typescript.js'].join(
                '\n',
            ),
        );
    });

    test('refuses to build a clone another live gate holds, and builds nothing', async () => {
        // Given - a fresh clone whose .artifacts/gate.lock names the live process that laid it
        const result = await freshCloneCli.env({ FRESH_CLONE: 'gated' }).exec();

        // Then - the bootstrap refuses in the gate's words for a build, before tsdown writes dist/
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('or run a build in a worktree of its own');
        expect(result.stdout.text).toContain('built nothing');
    });

    test('refuses to build a clone whose settings file exports no settings, and builds nothing', async () => {
        // Given - a fresh clone whose studio.config.ts exports a number
        const result = await freshCloneCli.env({ FRESH_CLONE: 'unresolved' }).exec();

        // Then - the bootstrap refuses as `typescript build` does, before tsdown writes dist/
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain(
            'found: studio.config.ts exports no settings object as its default',
        );
        expect(result.stdout.text).toContain('built nothing');
    });
});
