import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, for the ground's sake: the claim needs the rule armed at `error`,
 * and oxlint loads every config under this repository — an armed one committed
 * under `_fixtures/` would report on its own broken tree during this
 * repository's lint run ([Testing](../../../docs/03-testing.md)).
 *
 * `unicorn/no-useless-undefined` stands for the eight: its fixer strips an
 * argument the callee requires, so `fix` must leave the line alone and
 * report it exactly as `check` does — the answer is a human's, and the two
 * commands read one verdict on one tree.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

const project = mkdtempSync(resolve(tmpdir(), 'spec-unsafe-fixers-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

const SOURCE = `export function take(value: string | undefined): string {
    return value ?? 'none';
}

export const taken = take(undefined);
`;

test('leaves a meaning-changing fixer alone and still reports it', () => {
    // Given - a project whose only diagnostic is one of the unsafe fixers
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { name: 'spec-unsafe-fixers', private: true, type: 'module', version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        'export default { plugins: ["unicorn"], rules: { "unicorn/no-useless-undefined": "error" } };\n',
    );
    writeFileSync(join(project, 'index.ts'), SOURCE);

    // When - the fix runs
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the argument is still there, and fix reports what it left
    expect(fixed.status).toBe(1);
    expect(fixed.stdout).toContain('no-useless-undefined');
    expect(readFileSync(join(project, 'index.ts'), 'utf8')).toContain('take(undefined)');

    // Then - the check still names the rule, because the answer is a human's
    const checked = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });
    expect(checked.status).toBe(1);
    expect(checked.stdout).toContain('no-useless-undefined');
});

test('keeps a directive that names an unsafe fixer used, so fix stays green', () => {
    // Given - the same project, the one diagnostic suppressed with its reason
    writeFileSync(
        join(project, 'index.ts'),
        SOURCE.replace(
            'export const taken',
            '// oxlint-disable-next-line unicorn/no-useless-undefined -- the callee requires it\nexport const taken',
        ),
    );

    // When - the fix runs with that rule allowed for the rewrite
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the verdict is the check's, where the rule is armed and the directive used
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).not.toContain('Unused oxlint-disable directive');
});

test('leaves the fixer alone where an override of the consumer arms the rule again', () => {
    // Given - the rule off in the base config and armed by an override, the vitest block's shape
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        [
            'export default {',
            "    plugins: ['unicorn'],",
            "    rules: { 'unicorn/no-useless-undefined': 'off' },",
            "    overrides: [{ files: ['**/*.ts'], rules: { 'unicorn/no-useless-undefined': 'error' } }],",
            '};',
            '',
        ].join('\n'),
    );
    writeFileSync(join(project, 'index.ts'), SOURCE);

    // When - the fix runs
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the argument survives the rewrite, and the wrapper left no trace
    expect(fixed.status).toBe(1);
    expect(readFileSync(join(project, 'index.ts'), 'utf8')).toContain('take(undefined)');
    expect(existsSync(join(project, 'oxlint.fix.config.mjs'))).toBe(false);
});

/*
 * The same claim, one layer down. Every test above arms a rule oxlint itself
 * decides; the wrapper's `overrides` block is oxlint's own vocabulary and
 * reaching it is oxlint's job. A TYPE-AWARE rule is not oxlint's: it runs in
 * `tsgolint`, a separate binary oxlint hands the file to, and nothing here
 * held that half — the rewrite below is the one a spike measured in
 * @jterrazz/test, where a broken module augmentation widened a parameter to
 * `any` and the fixer then read the cast that reached it as unnecessary.
 */
test('leaves a type-aware fixer alone — the double cast the call still needs', () => {
    // Given - a project whose one diagnostic is a type-aware unsafe fixer
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        [
            'export default {',
            '    options: { typeAware: true },',
            "    plugins: ['typescript'],",
            "    rules: { 'typescript/no-unnecessary-type-assertion': 'error' },",
            '};',
            '',
        ].join('\n'),
    );
    writeFileSync(
        join(project, 'index.ts'),
        [
            'export function takes(value: string): string {',
            '    return value;',
            '}',
            '',
            'declare const widened: any;',
            '',
            'export const taken = takes(widened as unknown as string);',
            '',
        ].join('\n'),
    );

    // When - the fix runs
    const fixed = spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the cast survives, so the file still says which type the call receives
    expect(readFileSync(join(project, 'index.ts'), 'utf8')).toContain(
        'widened as unknown as string',
    );

    // Then - and the rule is still reported, because the answer is a human's
    expect(fixed.status).toBe(1);
    expect(fixed.stdout).toContain('no-unnecessary-type-assertion');
});

const AUGMENTATION = `declare module 'some-library' {
    interface Options {
        update: boolean;
    }
}

export {};
`;

test('leaves a declare module augmentation an interface, and keeps its export {}', () => {
    // Given - a project whose one file augments a library, with both rewriters armed
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(
        join(project, 'oxlint.config.ts'),
        [
            'export default {',
            "    plugins: ['typescript'],",
            '    rules: {',
            "        'typescript/consistent-type-definitions': ['error', 'type'],",
            "        'typescript/no-useless-empty-export': 'error',",
            '    },',
            '};',
            '',
        ].join('\n'),
    );
    writeFileSync(join(project, 'index.ts'), AUGMENTATION);

    // When - the fix runs
    spawnSync('bash', [BIN, 'fix'], { cwd: project, encoding: 'utf8' });

    // Then - the block still merges: an interface, and the export that makes it an augmentation
    const fixed = readFileSync(join(project, 'index.ts'), 'utf8');
    expect(fixed).toContain('interface Options');
    expect(fixed).toContain('export {};');
});
