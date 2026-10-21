import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

const verdictOf = (content: string): unknown => JSON.parse(content);

const UNDECLARED =
    "jterrazz.config.ts:1:1: error config(project-declared): found: jterrazz.config.ts is missing · why: A project (a single-project repository, or each member of a monorepo) declares what it is once, its kind and its platform, in jterrazz.config.ts. · fix: write `export default defineConfig({ kind, platform })` from `@jterrazz/typescript/config` in jterrazz.config.ts, the kind one of `library`, `api`, `cli`, `website`, `mobile`, `content` and the platform one of `node`, `bun`, `react`, `next`, `astro`, `expo`, `browser`; a monorepo's own suite at `specs/` declares its platform alone, one of `node`, `bun`, and the root of a monorepo (a package.json listing `workspaces`) declares no kind; `content`, a repository with no code, declares no platform · read: docs/reference/quality-checks.md#the-config-one-file-pass";

describe('verdict-file', () => {
    test('leaves its verdict in .artifacts/gate/verdict.json: each pass that ran with its first finding, the drift report among them, and the run red', async () => {
        // Given - an application that declares nothing, checked by its config pass and the drift report alone
        const result = await cli
            .with({ env: onlyPasses('config', 'drift') })
            .fixture(directory('../__fixtures__/sample-app/'))
            .exec('check');

        // Then - the file names the command, the config pass red with its first finding, the drift report green, and no mutation
        expect(verdictOf(result.file('.artifacts/gate/verdict.json').content)).toMatchObject({
            command: 'check',
            mutation: null,
            passes: [
                { firstError: UNDECLARED, label: 'Config (one file)', status: 1 },
                { firstError: null, label: 'Drift (profile)', status: 0 },
            ],
            status: 1,
        });
    });

    test('appends what each pass it ran ended on to .artifacts/check/outcomes.jsonl, a red pass red', async () => {
        // Given - the same application, checked by its config pass and the drift report alone
        const result = await cli
            .with({ env: onlyPasses('config', 'drift') })
            .fixture(directory('../__fixtures__/sample-app/'))
            .exec('check');

        // Then - one line per pass, the config pass red, each with when it ended, its command and its seconds
        const lines = result
            .file('.artifacts/check/outcomes.jsonl')
            .content.split('\n')
            .filter((line) => line !== '');
        const ran = { command: 'check', head: null, kind: 'pass' };
        expect(lines.map((line) => verdictOf(line))).toMatchObject([
            { ...ran, name: 'Config (one file)', status: 'red' },
            { ...ran, name: 'Drift (profile)', status: 'green' },
        ]);
        expect(
            lines.filter((line) => /^\{"at":"[^"]+",.*"seconds":[\d.]+,/u.test(line)),
        ).toHaveLength(2);
    });
});
