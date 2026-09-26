import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

const MOVER = resolve(import.meta.dirname, 'rename.js');

const CONFIG = [
    "import { compose, node } from '@jterrazz/typescript/oxlint';",
    '',
    'export default compose(node, {',
    "    rules: { 'jterrazz-typescript/comment-longer-than-function': 'off' },",
    '});',
    '',
].join('\n');

function projectConfiguring(config: string): string {
    const root = mkdtempSync(join(tmpdir(), 'rename-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    writeFileSync(join(root, 'oxlint.config.ts'), config);

    return root;
}

describe('rename', () => {
    test('refuses an oxlint config that sets a rule by an id this release renamed', () => {
        // Given - a config turning the comment rule off by its old id
        const root = projectConfiguring(CONFIG);

        // When - the mover judges the project
        const result = spawnSync('node', [MOVER, root], { encoding: 'utf8' });

        // Then - the setting is named, with the fix that rewrites it
        expect(result.stdout).toBe(
            "renamed-id  oxlint.config.ts  found: line 4 configures `jterrazz-typescript/comment-longer-than-function`, an id this release renamed · why: oxlint knows the rule by its new id alone, so the setting reaches no rule · fix: run 'typescript fix' — it rewrites the config to `jterrazz-typescript/comment-no-longer-than-its-function` · read: docs/06-quality-checks.md#a-renamed-id\n",
        );
        expect(result.status).toBe(1);
    });

    test('rewrites the old id in the oxlint config under fix', () => {
        // Given - the same config
        const root = projectConfiguring(CONFIG);

        // When - the mover fixes the project
        spawnSync('node', [MOVER, root, '--fix'], { encoding: 'utf8' });

        // Then - the config sets the rule by its new id, and nothing else moved
        expect(readFileSync(join(root, 'oxlint.config.ts'), 'utf8')).toBe(
            CONFIG.replace('comment-longer-than-function', 'comment-no-longer-than-its-function'),
        );
    });
});
