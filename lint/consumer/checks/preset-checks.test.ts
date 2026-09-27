import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { typescriptPreset } from '../catalogue/preset.js';
import { presetChecks } from './preset-checks.js';

function treeOf(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'preset-checks-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

const importing = (specifier: string): string => `import '${specifier}';\n`;

const BASE = [typescriptPreset()];

describe('presetChecks', () => {
    test('finds one import per base law where it is written, and none where a catalogue law exempts it', async () => {
        // Given - a lint/ tree breaking each law once, a self catalogue extending the consumer one, and a catalogue test reading a rule
        const root = treeOf({
            'lint/consumer/catalogue/rows.test.ts': importing('../rules/plugin.js'),
            'lint/consumer/catalogue/rows.ts': `\n${importing('../rules/plugin.js')}`,
            'lint/consumer/checks/rule.ts': 'export {};\n',
            'lint/consumer/rules/plugin.ts': importing('../checks/rule.js'),
            'lint/engine/reader.ts': importing('../consumer/checks/rule.js'),
            'lint/index.ts': importing('./self/checks/audit.js'),
            'lint/self/catalogue/manifest.ts': importing('../../consumer/catalogue/rows.js'),
            'lint/self/checks/audit.ts': 'export {};\n',
            'lint/self/rules/plugin.ts': importing('../checks/audit.js'),
            'package.json': '{ "name": "acme", "type": "module" }\n',
            'src/main.ts': importing('../lint/consumer/catalogue/rows.js'),
        });

        // When - the base preset's laws run on it
        const { findings, problems } = await presetChecks(root, { base: BASE, config: {} });

        // Then - each law reports once, at the specifier's opening quote
        expect(problems).toStrictEqual([]);
        expect(
            findings
                .map(({ column, line, path, rule }) => `${path}:${line}:${column} ${rule}`)
                .toSorted(),
        ).toStrictEqual([
            'lint/consumer/catalogue/rows.ts:2:8 architecture/catalogue-at-the-bottom',
            'lint/consumer/rules/plugin.ts:1:8 architecture/consumer-folders-apart',
            'lint/engine/reader.ts:1:8 architecture/engine-knows-no-declaration',
            'lint/index.ts:1:8 architecture/shipped-lint-reads-no-self',
            'lint/self/rules/plugin.ts:1:8 architecture/self-folders-apart',
            'src/main.ts:1:8 architecture/src-reads-no-declaration',
        ]);
    });

    test('holds a tree to a names rule the settings declare, with its four-part lesson', async () => {
        // Given - a module named in camel case, and a rule the repository adds beside the base preset
        const root = treeOf({
            'package.json': '{ "name": "acme", "type": "module" }\n',
            'src/orderLine.ts': 'export {};\n',
        });
        const config = {
            typescript: {
                names: [
                    {
                        fix: 'rename it in kebab-case',
                        ls: { src: { '.ts': 'kebab-case' } },
                        name: 'module-in-kebab-case',
                        read: 'docs/naming.md#modules',
                        why: 'one case for every module keeps a search to one spelling',
                    },
                ],
            },
        };

        // When - the resolved laws run on it
        const { findings, problems } = await presetChecks(root, { base: BASE, config });

        // Then - the rule reports at the file, in four parts
        expect(problems).toStrictEqual([]);
        expect(findings).toStrictEqual([
            {
                column: 1,
                line: 1,
                message:
                    "found: `src/orderLine.ts` breaks ls-lint's `.ts: kebabcase` · why: one case for every module keeps a search to one spelling · fix: rename it in kebab-case · read: docs/naming.md#modules",
                path: 'src/orderLine.ts',
                rule: 'names/module-in-kebab-case',
            },
        ]);
    });
});
