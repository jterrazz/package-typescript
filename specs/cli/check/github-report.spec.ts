import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// invariant: GitHub sets `GITHUB_ACTIONS=true`, names the step summary file and the workspace on every step; the run states all three, and the workspace is the fixture's parent, so a path is seen read from it.

const ON_GITHUB = {
    GITHUB_ACTIONS: 'true',
    GITHUB_STEP_SUMMARY: '$WORKDIR/summary.md',
    GITHUB_WORKSPACE: '$WORKDIR/..',
};

// invariant: the fixture's folder is named by the run, so it is read from the first annotation, one segment under the workspace.
function workdirOf(stdout: string, file: string): string {
    const name = new RegExp(`::error file=([^/,]+)/${file},`, 'u').exec(stdout)?.[1];
    expect(name).toMatch(/^[^/]+$/u);

    return name ?? '';
}

describe('github-report', () => {
    test('on a GitHub runner, a red check prints one line per pass, each finding over its lines, an annotation each, and writes the step summary', async () => {
        // Given - a project with two type errors, checked by the type and secrets passes on a runner
        const result = await cli
            .env({ ...ON_GITHUB, ...onlyPasses('typescript', 'secrets') })
            .fixture(directory('./__fixtures__/typechecker/invalid/'))
            .exec('check');

        // Then - the pass lines, the red one folding the compiler's raw report, then the findings, their annotations from the workspace, and the last line
        const workdir = workdirOf(result.stdout.text, 'types.ts');
        expect(result.exitCode).toBe(1);
        expect(
            result.stdout.text
                .replaceAll(/\d+\.\ds/gu, '<s>')
                .replaceAll(/stop-commands::[\da-f-]{36}/gu, 'stop-commands::<token>')
                .replaceAll(/::[\da-f-]{36}::/gu, '::<token>::'),
        ).toBe(
            [
                '▸ typescript check',
                '::group::types         ✗ 2 errors · <s>',
                '::stop-commands::<token>',
                "types.ts(1,7): error TS2322: Type 'number' is not assignable to type 'string'.",
                "types.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.",
                '::<token>::',
                '::endgroup::',
                'secrets       ✓ <s>',
                '',
                `error typescript(TS2322)  ${workdir}/types.ts:1:7`,
                "  Type 'number' is not assignable to type 'string'.",
                '',
                `error typescript(TS2322)  ${workdir}/types.ts:2:7`,
                "  Type 'string' is not assignable to type 'number'.",
                '',
                `::error file=${workdir}/types.ts,line=1,col=7,title=typescript(TS2322)::Type 'number' is not assignable to type 'string'.`,
                `::error file=${workdir}/types.ts,line=2,col=7,title=typescript(TS2322)::Type 'string' is not assignable to type 'number'.`,
                '✗ 2 passes, 1 failed: types',
                '',
            ].join('\n'),
        );
        expect(result.file('summary.md').content.replaceAll(/\d+\.\ds/gu, '<s>')).toBe(
            [
                '### typescript check',
                '',
                '| Pass | Result | Time |',
                '| --- | --- | --- |',
                '| types | ✗ 2 errors | <s> |',
                '| secrets | ✓ | <s> |',
                '',
                '**Findings**',
                '',
                `- \`typescript(TS2322)\` \`${workdir}/types.ts:1:7\`: Type 'number' is not assignable to type 'string'.`,
                `- \`typescript(TS2322)\` \`${workdir}/types.ts:2:7\`: Type 'string' is not assignable to type 'number'.`,
                '',
                '',
            ].join('\n'),
        );
    });

    test("on a GitHub runner, a lesson's why stays in the pass's fold: the finding states what was found, its fix and where to read", async () => {
        // Given - a monorepo whose members break their kind's manifest, checked by the config pass on a runner
        const result = await cli
            .env({ ...ON_GITHUB, ...onlyPasses('config') })
            .fixture(directory('./__fixtures__/config/kinds/'))
            .exec('check');

        // Then - the finding's block carries no why, and the raw line in the fold still does
        const workdir = workdirOf(result.stdout.text, 'packages/cli/package.json');
        const [fold = '', findings = ''] = result.stdout.text.split('::endgroup::\n');
        expect(fold).toContain('· why: A library publishes its exports');
        expect(findings).not.toContain('why');
        expect(findings).toContain(
            [
                `error config(kind-matches-manifest)  ${workdir}/packages/cli/package.json:1:1`,
                '  packages/cli/studio.config.ts declares a cli, and packages/cli/package.json names no `bin`',
                '  fix   name the command in `bin`, set `"private": true` when the repository installs the binary itself, or declare the kind the project is',
                '  read  docs/reference/quality-checks.md#the-config-one-file-pass',
            ].join('\n'),
        );
        expect(findings).toContain(
            `::error file=${workdir}/packages/cli/package.json,line=1,col=1,title=config(kind-matches-manifest)::packages/cli/studio.config.ts declares a cli, and packages/cli/package.json names no \`bin\`\n`,
        );
        expect([result.exitCode, findings.endsWith('✗ 1 pass, 1 failed: config\n')]).toStrictEqual([
            1,
            true,
        ]);
    });

    test('on a GitHub runner, the drift report is a fold of its own, then its line, and a fix names itself', async () => {
        // Given - a green project, checked by the type pass and the drift report, then fixed, on a runner
        const project = cli
            .env({ ...ON_GITHUB, ...onlyPasses('typescript', 'drift') })
            .fixture(directory('./__fixtures__/typechecker/valid/'));

        // When - it is checked, then fixed
        const checked = await project.exec('check');
        const fixed = await project.exec('fix');

        // Then - the report sits in its fold before its line; the fix's first line and summary say fix
        expect(checked.stdout.text).toMatch(
            /^▸ typescript check\ntypes {9}✓ \d+\.\ds\n::group::drift \(profile report\)\n[\s\S]*\n::endgroup::\ndrift {9}✓ \d+\.\ds\n✓ 2 passes, all green\n$/u,
        );
        expect(fixed.stdout.text.split('\n')[0]).toBe('▸ typescript fix');
        expect(fixed.file('summary.md').content).toContain('### typescript fix\n');
    });
});
