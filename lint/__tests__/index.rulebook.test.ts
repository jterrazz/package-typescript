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

type Config = Awaited<ReturnType<typeof oxlintConfigAt>>;

const baseOverrideIn = (config: Config) => (member: string) =>
    (config.overrides ?? []).find(({ files }) => files.length === 1 && files[0] === `${member}/**`);

function membersSeen(config: Config) {
    const base = baseOverrideIn(config);

    return {
        api: [base('apps/api')?.env, base('apps/api')?.plugins?.includes('typescript')],
        legacy: base('apps/legacy'),
        mobileGlobals: '__DEV__' in (base('apps/mobile')?.globals ?? {}),
        webBrowser: base('apps/web')?.env?.browser,
    };
}

function rulesSeen(config: Config) {
    const base = baseOverrideIn(config);
    const scoped = (config.overrides ?? []).find(({ files }) => files.includes('apps/web/src/**'));

    return {
        jsPlugins: (base('apps/api')?.jsPlugins ?? []).length > 0,
        own: base('apps/api')?.rules?.['no-console'],
        scoped: [scoped?.rules, scoped?.plugins === base('apps/web')?.plugins],
        unset: base('apps/api')?.rules?.['no-plusplus'],
    };
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

    test('oxlintConfigAt — a workspace — each configured member is linted by its own profile inside its folder, a member without config is left to the root', async () => {
        // Given - a workspace with a node member, a member without config, an expo member and a react member
        const root = workspace({
            'apps/api/jterrazz.config.ts': "export default { kind: 'api', platform: 'node' };\n",
            'apps/api/package.json': '{ "name": "api", "private": true }\n',
            'apps/legacy/package.json': '{ "name": "legacy", "private": true }\n',
            'apps/mobile/jterrazz.config.ts':
                "export default { kind: 'mobile', platform: 'expo' };\n",
            'apps/mobile/package.json': '{ "name": "mobile", "private": true }\n',
            'apps/web/jterrazz.config.ts':
                "export default { kind: 'website', platform: 'react', typescript: { oxlint: { overrides: [{ files: ['src/**'], reason: 'r', rules: { 'react/jsx-no-useless-fragment': 'off' } }] } } };\n",
            'apps/web/package.json': '{ "name": "web", "private": true }\n',
            'jterrazz.config.ts':
                "export default { kind: 'workspace', typescript: { oxlint: { rules: { 'no-plusplus': { level: 'error', reason: 'r' } } } } };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - the workspace config is built
        const config = await oxlintConfigAt(root);
        // Then - every configured member has its own base override and the config-less one has none
        expect(membersSeen(config)).toStrictEqual({
            api: [{ builtin: true, node: true }, true],
            legacy: undefined,
            mobileGlobals: true,
            webBrowser: true,
        });

        // Then - a rule the root sets and the member does not is switched off inside the member, a rule the member sets stays its own, its override is scoped to its folder with its plugins
        expect(rulesSeen(config)).toStrictEqual({
            jsPlugins: true,
            own: 'error',
            scoped: [{ 'react/jsx-no-useless-fragment': 'off' }, true],
            unset: 'off',
        });

        // Then - the ignored ground of each member is prefixed by its folder, after the root's own
        expect(config.ignorePatterns).toStrictEqual(
            expect.arrayContaining(['dist/**', 'apps/api/dist/**', 'apps/mobile/.expo/**']),
        );
        expect(config.ignorePatterns).not.toContain('apps/legacy/dist/**');
    });
});
