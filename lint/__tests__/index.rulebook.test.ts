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
        unset: base('apps/api')?.rules?.['no-undef-init'],
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

    test('oxlintConfigAt — a workspace — a member’s override on its test files follows the rulebook’s override of every test file, so it wins', async () => {
        // Given - a workspace whose react member relaxes a vitest rule on its own test files
        const root = workspace({
            'apps/web/jterrazz.config.ts':
                "export default { kind: 'website', platform: 'react', typescript: { oxlint: { overrides: [{ files: ['src/**/__tests__/**'], reason: 'the member decides', rules: { 'vitest/max-expects': 'off' } }] } } };\n",
            'apps/web/package.json': '{ "name": "web", "private": true }\n',
            'jterrazz.config.ts': "export default { kind: 'workspace' };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - the config is derived
        const derived = await oxlintConfigAt(root);
        const overrides = derived.overrides ?? [];
        const ofRulebook = overrides.findLastIndex(
            ({ files, rules }) =>
                files.some((glob) => glob.startsWith('**/__tests__/')) &&
                rules?.['vitest/max-expects'] !== undefined,
        );
        const ofMember = overrides.findIndex(({ files }) =>
            files.includes('apps/web/src/**/__tests__/**'),
        );

        // Then - the rulebook’s override of the test files comes first, the member’s after it
        expect([ofRulebook !== -1, ofRulebook < ofMember]).toStrictEqual([true, true]);
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
                "export default { kind: 'workspace', typescript: { oxlint: { rules: { 'no-undef-init': { level: 'error', reason: 'r' } } } } };\n",
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

    test('oxlintConfigAt — a settings file that does not resolve, a rule set apart with no reason and a folder platform nobody knows are each refused, naming the file', async () => {
        // Given - a unit declaring a kind that does not exist, one whose rule carries no reason, and one placing a folder on an unknown platform
        const unknownKind = workspace({
            'jterrazz.config.ts': "export default { kind: 'bogus', platform: 'node' };\n",
            'package.json': '{ "name": "x", "private": true }\n',
        });
        const silentRule = workspace({
            'jterrazz.config.ts':
                "export default { kind: 'api', platform: 'node', typescript: { oxlint: { rules: { 'no-debugger': 'off' } } } };\n",
            'package.json': '{ "name": "x", "private": true }\n',
        });
        const unknownPlatform = workspace({
            'jterrazz.config.ts':
                "export default { kind: 'api', platform: 'node', typescript: { platforms: { scripts: { platform: 'cobol', reason: 'r' } } } };\n",
            'package.json': '{ "name": "x", "private": true }\n',
        });

        // When - each is derived
        const outcomes = await Promise.allSettled(
            [unknownKind, silentRule, unknownPlatform].map(
                async (root) => await oxlintConfigAt(root),
            ),
        );

        // Then - each is refused with the settings file named
        expect(
            outcomes.map(
                (outcome) =>
                    outcome.status === 'rejected' &&
                    String(outcome.reason).includes('jterrazz.config.ts') &&
                    String(outcome.reason).includes(
                        'docs/reference/configuration.md#the-merge-order',
                    ),
            ),
        ).toStrictEqual([true, true, true]);
    });

    test('oxlintConfigAt — a unit that is no workspace reads no member, though its manifest lists some', async () => {
        // Given - an api whose manifest lists a member that declares a platform of its own
        const root = workspace({
            'apps/web/jterrazz.config.ts':
                "export default { kind: 'website', platform: 'react' };\n",
            'apps/web/package.json': '{ "name": "web", "private": true }\n',
            'jterrazz.config.ts': "export default { kind: 'api', platform: 'node' };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - its config is derived
        const config = await oxlintConfigAt(root);

        // Then - no override is scoped to the member
        expect((config.overrides ?? []).some(({ files }) => files.includes('apps/web/**'))).toBe(
            false,
        );
    });

    test('oxlintConfigAt — a member’s override keeps the files it excludes, under the member’s folder, and a member sets no globals the profile does not', async () => {
        // Given - a workspace whose api member brings a preset overriding a rule except in a generated folder
        const root = workspace({
            'apps/api/jterrazz.config.ts':
                "export default { kind: 'api', platform: 'node', presets: [{ name: 'gen', package: 'gen', oxlint: { overrides: [{ files: ['src/**'], excludeFiles: ['src/generated/**'], rules: { 'no-console': 'off' } }] } }] };\n",
            'apps/api/package.json': '{ "name": "api", "private": true }\n',
            'jterrazz.config.ts': "export default { kind: 'workspace' };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - the workspace config is built
        const config = await oxlintConfigAt(root);
        const scoped = (config.overrides ?? []).find(({ files }) =>
            files.includes('apps/api/src/**'),
        );
        const base = (config.overrides ?? []).find(
            ({ files }) => files.length === 1 && files[0] === 'apps/api/**',
        );

        // Then - the exclusion follows the files, and the node member's base override names no globals
        expect([scoped?.excludeFiles, Object.keys(base ?? {}).includes('globals')]).toStrictEqual([
            ['apps/api/src/generated/**'],
            false,
        ]);
    });

    test.each(Object.entries(PROFILE_CONFIGS))(
        'the %s profile names its env, its JS plugins and its plugins',
        (_name, profile) => {
            // Given - a profile a member can be linted by
            // Then - each of the three a member's override carries is stated, so none is ever read as absent
            expect(
                [profile.env, profile.jsPlugins, profile.plugins].map((one) => one !== undefined),
            ).toStrictEqual([true, true, true]);
        },
    );
});
