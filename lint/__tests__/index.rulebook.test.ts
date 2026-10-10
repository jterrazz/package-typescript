import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { oxlintConfigAt, PROFILE_CONFIGS } from '../index.rulebook.js';

function workspace(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'rulebook-workspace-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

describe('index.rulebook', () => {
    test.each(Object.entries(PROFILE_CONFIGS))(
        'the %s profile never lints the ground a spec stands on',
        (_name, profile) => {
            // Given - a profile a consumer names
            // Then - the four ground folders among the special folders @jterrazz/test reads are ignored wherever they sit
            expect(profile.ignorePatterns).toStrictEqual(
                expect.arrayContaining([
                    '**/__fixtures__/**',
                    '**/__expected__/**',
                    '**/__seeds__/**',
                    '**/__requests__/**',
                ]),
            );
        },
    );

    test('oxlintConfigAt — a workspace — the root overrides come after the members’, each member override carries its member’s plugins', async () => {
        // Given - a workspace whose root overrides a rule for a member’s files, and a react member overriding a react rule of its own
        const root = workspace({
            'apps/web/jterrazz.config.ts':
                "export default { kind: 'website', platform: 'react', typescript: { oxlint: { overrides: [{ files: ['src/**'], reason: 'the member decides', rules: { 'react/jsx-no-useless-fragment': 'off' } }] } } };\n",
            'apps/web/package.json': '{ "name": "web", "private": true }\n',
            'jterrazz.config.ts':
                "export default { kind: 'workspace', typescript: { oxlint: { overrides: [{ files: ['apps/web/src/**'], reason: 'the root decides', rules: { 'no-console': 'off' } }] } } };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - the config is derived
        const config = await oxlintConfigAt(root);
        const overrides = (config.overrides ?? []).map(({ files, plugins, rules }) => ({
            files,
            plugins: plugins?.includes('react') === true,
            reactRule: rules?.['react/jsx-no-useless-fragment'],
            consoleRule: rules?.['no-console'],
        }));
        const ofMember = overrides.findIndex(({ files }) => files.includes('apps/web/src/**'));
        const ofRoot = overrides.findLastIndex(({ consoleRule }) => consoleRule === 'off');

        // Then - the member's own override leads with the react plugin it needs, and the root's override is the very last
        expect(overrides[ofMember]).toStrictEqual({
            consoleRule: undefined,
            files: ['apps/web/src/**'],
            plugins: true,
            reactRule: 'off',
        });
        expect([ofRoot === overrides.length - 1, ofMember < ofRoot]).toStrictEqual([true, true]);
    });
});
