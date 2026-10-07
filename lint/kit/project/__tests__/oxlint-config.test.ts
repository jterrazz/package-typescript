import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { printedOxlintConfig } from '../oxlint-config.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../package-root.js';

const OXLINT = binaryIn('oxlint', HOISTED_BESIDE_PACKAGE);

function projectWithConfigs(): string {
    const root = mkdtempSync(join(tmpdir(), 'oxlint-config-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, '.oxlintrc.json'), '{ "rules": { "eqeqeq": "error" } }\n');
    writeFileSync(
        join(root, 'handed.json'),
        '{ "plugins": ["import"], "rules": { "no-console": "error" } }\n',
    );

    return root;
}

const ruleLevels = (root: string, configPath?: null | string): unknown[] => {
    const printed = printedOxlintConfig(root, OXLINT, configPath);

    return [
        printed?.rules?.eqeqeq,
        printed?.rules?.['no-console'],
        printed?.plugins?.includes('import'),
    ];
};

describe('oxlint-config', () => {
    test('printedOxlintConfig — prints the config oxlint finds in the project, or the one handed to it by path instead', () => {
        // Given - a project whose own config and a config beside it each turn one rule on, the one beside it a plugin too
        const root = projectWithConfigs();

        // Then - no path reads the project's own, a path reads that file alone
        expect([
            ruleLevels(root, null),
            ruleLevels(root),
            ruleLevels(root, 'handed.json'),
        ]).toStrictEqual([
            ['deny', undefined, false],
            ['deny', undefined, false],
            [undefined, 'deny', true],
        ]);
    });

    test('printedOxlintConfig — is no config where oxlint prints none', () => {
        // Given - a path no config sits at
        // Then - nothing a caller could read as a config
        expect(printedOxlintConfig(projectWithConfigs(), OXLINT, 'missing.json')).toBeNull();
    });
});
