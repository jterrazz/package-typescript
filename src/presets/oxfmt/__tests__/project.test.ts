import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { oxfmtConfigAt } from '../project.js';

function tree(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'oxfmt-project-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

describe('oxfmtConfigAt', () => {
    test('a workspace root keeps as written what each member keeps, a file a member names included, under the member’s folder', async () => {
        // Given - a workspace whose root keeps a folder and whose member keeps one file and one verbatim root
        const root = tree({
            'apps/site/studio.config.ts':
                "export default { kind: 'website', platform: 'react', typescript: { oxfmt: { ignore: { 'docs/upstream.md': 'quoted' } }, roots: { notes: { reason: 'scratch', verbatim: true } } } };\n",
            'apps/site/package.json': '{ "name": "site", "private": true }\n',
            'studio.config.ts':
                "export default { typescript: { oxfmt: { ignore: { vendor: 'shipped' } } } };\n",
            'package.json': '{ "name": "ws", "private": true, "workspaces": ["apps/*"] }\n',
        });

        // When - the root's formatter config is derived
        const { ignorePatterns = [] } = await oxfmtConfigAt(root);

        // Then - the root's own folder as its tree, the member's file as the file it is and its verbatim root as a tree, each under apps/site/
        expect(
            ignorePatterns.filter((pattern) => !/^(?:apps\/site\/)?\*\*\//u.test(pattern)),
        ).toStrictEqual([
            'dist/**',
            'assets/**',
            'public/**',
            '.next/**',
            '.expo/**',
            'vendor/**',
            'apps/site/dist/**',
            'apps/site/assets/**',
            'apps/site/public/**',
            'apps/site/.next/**',
            'apps/site/.expo/**',
            'apps/site/docs/upstream.md',
            'apps/site/notes/**',
        ]);
    });

    test('leaves a spec document to the document formatter of the test package', async () => {
        // Given - a plain project
        const root = tree({
            'studio.config.ts': "export default { kind: 'library', platform: 'node' };\n",
            'package.json': '{ "name": "plain", "version": "1.0.0" }\n',
        });

        // When - the formatter config is derived
        const { ignorePatterns = [] } = await oxfmtConfigAt(root);

        // Then - the spec documents of any folder are ignored
        expect(ignorePatterns).toContain('**/*.spec.yaml');
    });
});
